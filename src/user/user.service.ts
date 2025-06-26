import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import { User, UserDocument } from './user.schema';
import { v4 as uuidv4 } from 'uuid';
import { RegisterDto } from './dto/register.dto';
import {
  ChangeEmailDto,
  ChangePassword,
  ConfirmEmailDto,
  EditUserDto,
} from './dto/update-user.dto';
import { JwtService } from '@nestjs/jwt';
import { TopFollowerDto } from './dto/top-followers.dto';
import { Relation, RelationDocument } from 'src/relation/relation.schema';
import { Post, PostDocument } from 'src/post/post.schema';
import { InteractionPoint } from './dto/search-user.dto'
import { Story, StoryDocument } from 'src/story/schema/story.schema';
import { Logger } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { error } from 'console';

@Injectable()
export class UserService {
  private mailer: nodemailer.Transporter;
  private readonly logger: Logger = new Logger();
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    @InjectModel(Relation.name) private readonly relationModel: Model<RelationDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Story.name) private storyModel: Model<StoryDocument>,
  ) {
    // configure your SMTP transport via environment variables
    this.mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: +(process.env.SMTP_PORT ?? 587),
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async findById(id: string) {
    return this.userModel.findById(id).select('_id handleName profilePic role');
  }

  async register(registerDto: RegisterDto): Promise<User> {
    const { email, password, profilePic } = registerDto;
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let username: string = '';
    let handleName: string = '';
    let isUnique = false;

    while (!isUnique) {
      const suffix = uuidv4().slice(0, 8);
      username = `user_${suffix}`;
      handleName = `user_${suffix}`;

      const existing = await this.userModel.findOne({
        $or: [{ username }, { handleName }],
      });

      if (!existing) {
        isUnique = true;
      }
    }

    const newUser = new this.userModel({
      email,
      password: hashedPassword,
      username: username,
      handleName: handleName,
      isVip: false,
      deletedAt: false,
      profilePic:
        profilePic ||
        'https://i.pinimg.com/736x/3c/67/75/3c67757cef723535a7484a6c7bfbfc43.jpg',
    });

    return newUser.save();
  }

  async getUserById(userId: string): Promise<Partial<User>> {
    // console.log('[getUserById] Called with userId:', userId);

    const user = await this.userModel.findById(userId).lean();
    // console.log('[getUserById] Fetched user:', user);

    if (!user) {
      // console.warn('[getUserById] User not found!');
      throw new NotFoundException('User not found');
    }

    const { password, refreshToken, ...safeUser } = user;
    return safeUser;
  }

  async findManyByIds(
    ids: string[],
  ): Promise<(Partial<User> & { _id: string })[]> {
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    const users = await this.userModel.find({ _id: { $in: objectIds } }).lean();

    return users.map((u) => {
      const { password, refreshToken, ...safe } = u;
      return {
        ...safe,
        _id: safe._id.toString(), // Convert to string
      };
    });
  }

  async validateRefreshToken(userId: string, token: string): Promise<boolean> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.refreshToken === token;
  }

  async logout(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.refreshToken = '';
    await user.save();
  }

  async checkEmailExists(email: string): Promise<boolean> {
    const user = await this.userModel.findOne({ email }).lean();
    return !!user;
  }

  /**
   * fetches another user's public info by their userId.
   * returns an object with exactly these fields (defaulting to '' or false if absent)
   */
  async getPublicProfile(userId: string): Promise<{
    username: string;
    phoneNumber: string;
    handleName: string;
    bio: string;
    address: string;
    gender: string;
    profilePic: string;
    isVip: boolean;
  }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('User not found');
    }

    const user = await this.userModel.findById(userId).lean().select({
      username: 1,
      phoneNumber: 1,
      handleName: 1,
      bio: 1,
      address: 1,
      gender: 1,
      profilePic: 1,
      isVip: 1,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      username: user.username || '',
      phoneNumber: user.phoneNumber || '',
      handleName: user.handleName || '',
      bio: user.bio || '',
      address: user.address || '',
      gender: user.gender || '',
      profilePic: user.profilePic || '',
      isVip: user.isVip || false,
    };
  }

  /**
   * run a paginated search on Users collection
   *   'username' mode: split keyword on spaces, requiring all tokens in username (case-insensitive)
   *   'handleName' mode: remove all whitespace from keyword, then do a case-insensitive substring match on handleName
   */
  async searchUsersRawPaginated(
    keyword: string,
    mode: 'username' | 'handleName',
    page: number,
    limit: number,
  ): Promise<{ items: Partial<User>[]; totalCount: number }> {
    // build the 'match' stage based on mode
    let matchStage: Record<string, any> = { deletedAt: { $eq: false } };

    if (mode === 'username') {
      // multi‐word, case‐insensitive: each token must appear somewhere in `username`
      const tokens = keyword
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 0);

      if (tokens.length > 1) {
        const andClauses = tokens.map((tok) => ({
          username: {
            $regex: tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            $options: 'i',
          },
        }));
        matchStage = { ...matchStage, $and: andClauses };
      } else {
        // single token
        const single = tokens[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        matchStage = {
          ...matchStage,
          username: { $regex: single, $options: 'i' },
        };
      }
    } else {
      // mode === 'handleName'
      // remove all whitespace from keyword
      const searchKey = keyword.replace(/\s+/g, '').toLowerCase();
      // case‐insensitive substring match on handleName
      matchStage = {
        ...matchStage,
        handleName: {
          $regex: searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          $options: 'i',
        },
      };
    }

    const skipCount = (page - 1) * limit;

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 as -1 } },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }],
          data: [
            {
              $project: {
                _id: 1,
                username: 1,
                phoneNumber: 1,
                handleName: 1,
                bio: 1,
                address: 1,
                gender: 1,
                profilePic: 1,
                isVip: 1,
              },
            },
            { $skip: skipCount },
            { $limit: limit },
          ],
        },
      },
    ];

    const [aggResult] = await this.userModel.aggregate(pipeline).exec();
    const totalCount =
      aggResult.metadata.length > 0 ? aggResult.metadata[0].totalCount : 0;
    return { items: aggResult.data, totalCount };
  }

  // partially updates the user document with the given fields and ignores any undefined properties in dto
  async updateProfile(
    userId: string,
    dto: EditUserDto,
  ): Promise<Partial<User>> {
    // build a clean update object
    const update: Partial<Record<keyof EditUserDto, any>> = {};
    
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined && key !== 'password' && key !== 'handleName') {
        update[key] = value;
      }
    }

    // handleName uniqueness check if provided
    if (dto.handleName) {
      const existingUser = await this.userModel.findOne({
        handleName: { $regex: new RegExp(`^${dto.handleName}$`, 's') },
        _id: { $ne: userId }, // exclude current user
      });
      
      if (existingUser) {
        throw new BadRequestException(
          'Handle name is already taken',
        );
      }
      
      update.handleName = dto.handleName;
    }

    // handle password change if provided
    if (dto.password) {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      // check if new password is same as current
      const isSame = await bcrypt.compare(dto.password, user.password);
      if (isSame) {
        throw new BadRequestException(
          'New password must be different from the current password',
        );
      }
      // hash new password and add it to update object
      update.password = await bcrypt.hash(dto.password, 10);
    }

    // ensure there is something to update
    if (Object.keys(update).length === 0) {
      throw new BadRequestException('No editable fields provided');
    }

    const updated = await this.userModel
      .findByIdAndUpdate(userId, { $set: update }, { new: true })
      .lean();

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    // strip out sensitive fields
    const { _id, password, refreshToken, ...safe } = updated;
    return safe;
  }

  /** Edit user's email address
   *  Validate and send confirmation code to new email.
   */
  async initiateEmailChange(
    userId: string,
    dto: ChangeEmailDto,
  ): Promise<{ token: string }> {
    // check uniqueness
    const exists = await this.userModel.findOne({ email: dto.email }).lean();
    if (exists) {
      throw new ConflictException('Email already in use');
    }

    // generate confirmation code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // send email
    await this.mailer.sendMail({
      from: process.env.EMAIL_FROM,
      to: dto.email,
      subject: 'Your confirmation code',
      text: `Your confirmation code is: ${code}`,
    });

    const token = this.jwtService.sign(
      { sub: userId, newEmail: dto.email, code },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      },
    );

    return { token };
  }

  // verify token + code and update email
  async confirmEmailChange(
    userId: string,
    dto: ConfirmEmailDto,
  ): Promise<void> {
    let payload: { sub: string; newEmail: string; code: string };
    try {
      payload = this.jwtService.verify(dto.token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch (err) {
      throw new BadRequestException('Invalid or expired token');
    }

    if (payload.sub !== userId) {
      throw new BadRequestException('Token does not belong to current user');
    }
    if (payload.code !== dto.code.toUpperCase()) {
      throw new BadRequestException('Confirmation code mismatch');
    }

    const updated = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: { email: payload.newEmail } },
      { new: true },
    );
    if (!updated) {
      throw new NotFoundException('User not found');
    }
  }

  /*======================== ADMIN-ONLY ========================*/

  async getTopFollowers(limit = 3): Promise<TopFollowerDto[]> {
    console.log('=== Starting corrected getTopFollowers ===');
    
    const docs = await this.relationModel.aggregate([
      // Match all relations that contain follow relationships
      {
        $match: {
          $or: [
            { relation: { $regex: /^FOLLOW_/ } },
            { relation: { $regex: /_FOLLOW$/ } } 
          ]
        }
      },
      
      // for mutual follows (FOLLOW_FOLLOW)
      {
        $facet: {
          // Case 1: userOne follows userTwo (FOLLOW_* patterns)
          userOneFollows: [
            {
              $match: {
                relation: { $regex: /^FOLLOW_/ }
              }
            },
            {
              $project: {
                followedUserId: '$userTwoID'
              }
            }
          ],
          
          // Case 2: userTwo follows userOne (*_FOLLOW patterns) 
          userTwoFollows: [
            {
              $match: {
                relation: { $regex: /_FOLLOW$/ }
              }
            },
            {
              $project: {
                followedUserId: '$userOneID'
              }
            }
          ]
        }
      },
      
      // Combine both arrays
      {
        $project: {
          allFollows: {
            $concatArrays: ['$userOneFollows', '$userTwoFollows']
          }
        }
      },
      
      // Unwind to get individual follow relationships
      { $unwind: '$allFollows' },
      
      // Replace root with the follow data
      { $replaceRoot: { newRoot: '$allFollows' } },
      
      // Group by followed user and count
      {
        $group: {
          _id: '$followedUserId',
          followerCount: { $sum: 1 }
        }
      },
      
      { $sort: { followerCount: -1 } },
      { $limit: limit },
      
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      { $unwind: '$userDetails' },
      
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          avatar: '$userDetails.profilePic',
          handle: '$userDetails.handleName',
          fullName: '$userDetails.username',
          followers: '$followerCount'
        }
      }
    ]);
    
    console.log('Corrected result:', JSON.stringify(docs, null, 2));
    
    return docs as TopFollowerDto[];
  }

  async getTodayStats(): Promise<{
    newUsers: string;
    newPosts: string;
    newReports: string;
  }> {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const [usersCount, postsCount] = await Promise.all([
      this.userModel.countDocuments({ createdAt: { $gte: start, $lt: end } }),
      this.postModel.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    ]);

    return {
      newUsers: usersCount.toString(),
      newPosts: postsCount.toString(),
      newReports: '0', // TODO: build a reports collection and hookup here
    };
  }  

  async getDailyNewAccounts(month: number): Promise<{
    month: string;
    data: { day: number; count: number }[];
    comparison: {
      previousMonth: string;
      currentTotal: number;
      previousTotal: number;
      percentageChange: number;
      trend: 'increase' | 'decrease' | 'no_change';
    };
  }> {
    if (month < 1 || month > 12) {
      throw new BadRequestException('Month must be between 1 and 12');
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const year = month <= currentMonth
      ? now.getFullYear()
      : now.getFullYear() - 1;

    // Calculate previous month and year
    let prevMonth: number;
    let prevYear: number;
    
    if (month === 1) {
      prevMonth = 12;
      prevYear = year - 1;
    } else {
      prevMonth = month - 1;
      prevYear = year;
    }

    // Current month date range
    const start = new Date(year, month - 1, 1, 0, 0, 0);
    const end = new Date(year, month, 1, 0, 0, 0);

    // Previous month date range
    const prevStart = new Date(prevYear, prevMonth - 1, 1, 0, 0, 0);
    const prevEnd = new Date(prevYear, prevMonth, 1, 0, 0, 0);

    // Get current month data
    const raw = await this.userModel.aggregate<{ _id: number; count: number }>([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { $dayOfMonth: '$createdAt' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id': 1 } },
    ]);

    // Get previous month total
    const prevMonthData = await this.userModel.aggregate<{ totalCount: number }>([
      { $match: { createdAt: { $gte: prevStart, $lt: prevEnd } } },
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
        },
      },
    ]);

    // Calculate totals
    const currentTotal = raw.reduce((sum, item) => sum + item.count, 0);
    const previousTotal = prevMonthData[0]?.totalCount || 0;

    // Calculate percentage change
    let percentageChange = 0;
    let trend: 'increase' | 'decrease' | 'no_change' = 'no_change';

    if (previousTotal === 0) {
      // If previous month had 0 accounts, any current accounts represent infinite growth
      percentageChange = currentTotal > 0 ? 100 : 0;
      trend = currentTotal > 0 ? 'increase' : 'no_change';
    } else {
      percentageChange = ((currentTotal - previousTotal) / previousTotal) * 100;
      if (percentageChange > 0) {
        trend = 'increase';
      } else if (percentageChange < 0) {
        trend = 'decrease';
      } else {
        trend = 'no_change';
      }
    }

    // Build full array with zeros where missing
    const lastDay = new Date(year, month, 0).getDate();
    const data = Array.from({ length: lastDay }, (_, i) => {
      const dayNum = i + 1;
      const found = raw.find(r => r._id === dayNum);
      return { day: dayNum, count: found?.count ?? 0 };
    });

    return {
      month: `${year}-${String(month).padStart(2, '0')}`,
      data,
      comparison: {
        previousMonth: `${prevYear}-${String(prevMonth).padStart(2, '0')}`,
        currentTotal,
        previousTotal,
        percentageChange: Math.round(percentageChange * 100) / 100, 
        trend,
      },
    };
  }

  async getInteractionChartForUser(userId: Types.ObjectId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); 
    const start = new Date(year, month, 1);
    const end   = new Date(year, month + 1, 1);

    // Calculate previous month
    let prevMonth: number;
    let prevYear: number;
    
    if (month === 0) { // January (month 0)
      prevMonth = 11; // December
      prevYear = year - 1;
    } else {
      prevMonth = month - 1;
      prevYear = year;
    }

    const prevStart = new Date(prevYear, prevMonth, 1);
    const prevEnd = new Date(prevYear, prevMonth + 1, 1);

    // aggregate daily counts for a model 
    const aggregateDaily = async (
      model: Model<any>,
      typeMatch?: Record<string, any>
    ): Promise<InteractionPoint[]> => {
      const match: any = {
        createdAt: { $gte: start, $lt: end },
        ...(typeMatch || {}),
      };
      const raw = await model
        .aggregate<{ _id: number; count: number }>([
          { $match: match },
          {
            $group: {
              _id: { $dayOfMonth: '$createdAt' },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id': 1 } },
        ])
        .exec();

      return raw.map(r => ({ day: r._id, count: r.count }));
    };

    // aggregate total counts for previous month
    const aggregateMonthTotal = async (
      model: Model<any>,
      typeMatch?: Record<string, any>
    ): Promise<number> => {
      const match: any = {
        createdAt: { $gte: prevStart, $lt: prevEnd },
        ...(typeMatch || {}),
      };
      const result = await model
        .aggregate<{ totalCount: number }>([
          { $match: match },
          {
            $group: {
              _id: null,
              totalCount: { $sum: 1 },
            },
          },
        ])
        .exec();

      return result[0]?.totalCount || 0;
    };

    // get daily post counts (current month)
    const rawPosts = await aggregateDaily(this.postModel, {
      userID: userId,
      type: { $in: ['post', 'reel'] },
    });
    
    // get daily story counts (current month)
    const rawStories = await aggregateDaily(this.storyModel, {
      ownerId: userId,
    });

    // get previous month totals
    const prevPostsTotal = await aggregateMonthTotal(this.postModel, {
      userID: userId,
      type: { $in: ['post', 'reel'] },
    });
    
    const prevStoriesTotal = await aggregateMonthTotal(this.storyModel, {
      ownerId: userId,
    });

    // calculate current month totals
    const currentPostsTotal = rawPosts.reduce((sum, item) => sum + item.count, 0);
    const currentStoriesTotal = rawStories.reduce((sum, item) => sum + item.count, 0);

    // calculate percentage changes
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) {
        return current > 0 ? 100 : 0;
      }
      return ((current - previous) / previous) * 100;
    };

    const postsPercentageChange = calculateChange(currentPostsTotal, prevPostsTotal);
    const storiesPercentageChange = calculateChange(currentStoriesTotal, prevStoriesTotal);

    // number of days in this month
    const lastDay = new Date(year, month + 1, 0).getDate();

    // bucket into 4 weeks
    const weeks = Array.from({ length: 4 }, (_, i) => ({
      week: `Week ${i+1}`,
      post: 0,
      story: 0,
    }));

    const accumulate = (raw: InteractionPoint[], field: 'post'|'story') =>
      raw.forEach(({ day, count }) => {
        const idx = Math.min(3, Math.floor((day - 1) / 7));
        weeks[idx][field] += count;
      });

    accumulate(rawPosts,  'post');
    accumulate(rawStories,'story');

    return {
      weeks,
      comparison: {
        currentMonth: `${year}-${String(month + 1).padStart(2, '0')}`,
        previousMonth: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`,
        posts: {
          current: currentPostsTotal,
          previous: prevPostsTotal,
          percentageChange: Math.round(postsPercentageChange * 100) / 100,
          trend: postsPercentageChange > 0 ? 'increase' : postsPercentageChange < 0 ? 'decrease' : 'no_change'
        },
        stories: {
          current: currentStoriesTotal,
          previous: prevStoriesTotal,
          percentageChange: Math.round(storiesPercentageChange * 100) / 100,
          trend: storiesPercentageChange > 0 ? 'increase' : storiesPercentageChange < 0 ? 'decrease' : 'no_change'
        }
      }
    };
  }

  async getUserWithInteractions(handleName: string) {
    const trimmed = handleName.trim();
    if (!trimmed) {
      throw new BadRequestException('handleName cannot be empty');
    }

    // case‐sensitive exact match
    const user = await this.userModel
      .findOne({ handleName: { $regex: `^${trimmed}$`, $options: 's' } })
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException(`User "${trimmed}" not found`);
    }

    // sanitize
    const clean: any = {
      _id:        user._id,
      username:   user.username,
      email:      user.email || '',
      phoneNumber:user.phoneNumber || '',
      handleName: user.handleName,
      bio:        user.bio || '',
      address:    user.address || '',
      gender:     user.gender || '',
      profilePic: user.profilePic || '',
      isVip:      user.isVip,
      deletedAt:  user.deletedAt || false,
    };

    // attach interaction chart + comparison
    const interactionData = await this.getInteractionChartForUser(
      user._id as Types.ObjectId
    );
    clean.interactionChartData = interactionData.weeks;
    clean.monthlyComparison      = interactionData.comparison;

    return clean;
  }

  async getRecommendedUsers(page = 1, limit = 20) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNext = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // count total users for pagination
    const totalCount = await this.userModel.countDocuments();

    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;

    const users = await this.userModel
      .aggregate([
        // lookup this month's posts count
        {
          $lookup: {
            from: this.postModel.collection.name,
            let: { uid: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$userID', '$$uid'] },
                      { $in: ['$type', ['post', 'reel']] },
                      { $gte: ['$createdAt', startOfMonth] },
                      { $lt: ['$createdAt', startOfNext] },
                    ],
                  },
                },
              },
              { $count: 'count' },
            ],
            as: 'postAgg',
          },
        },
        // lookup this month's stories count
        {
          $lookup: {
            from: this.storyModel.collection.name,
            let: { uid: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$ownerId', '$$uid'] },
                      { $gte: ['$createdAt', startOfMonth] },
                      { $lt: ['$createdAt', startOfNext] },
                    ],
                  },
                },
              },
              { $count: 'count' },
            ],
            as: 'storyAgg',
          },
        },
        // compute contributions = (postAgg[0].count || 0) + (storyAgg[0].count || 0)
        {
          $addFields: {
            contributions: {
              $add: [
                { $ifNull: [{ $arrayElemAt: ['$postAgg.count', 0] }, 0] },
                { $ifNull: [{ $arrayElemAt: ['$storyAgg.count', 0] }, 0] },
              ],
            },
          },
        },
        // sort: deletedAt false first, then contributions desc, then isVip desc
        {
          $sort: {
            deletedAt: 1,
            contributions: -1,
            isVip: -1,
          },
        },
        // project fields
        {
          $project: {
            _id:       1,
            username:  1,
            handleName:1,
            profilePic:1,
          },
        },
        // paginate
        { $skip: skip },
        { $limit: limit },
      ])
      .exec();

    return {
      data: users,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async changePassword(userId: string, body: ChangePassword) {
    const currentUser = await this.userModel.findById(userId).exec();
    if (!currentUser) {
      throw new HttpException(
        { 
          statusCode: HttpStatus.NOT_FOUND,
          message: 'failed',
          error: 'User not found'
        },
        HttpStatus.NOT_FOUND
      );
    }

    const isCurrentPasswordCorrect = bcrypt.compareSync(
      body.recentPassword,
      currentUser.password
    );
    if (!isCurrentPasswordCorrect) {
      throw new HttpException(
        { 
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'failed',
          error: 'Incorrect current password'
        },
        HttpStatus.BAD_REQUEST
      );
    }

    await this.userModel.findByIdAndUpdate(
      userId,
      { password: bcrypt.hashSync(body.newPassword, 10) }
    ).exec();

    const { password, ...cleanResponse } = currentUser.toObject();
    
    return {
      statusCode: HttpStatus.OK,
      message: 'success',
      data: cleanResponse
    };
  }

}
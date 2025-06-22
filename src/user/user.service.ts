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
  ConfirmEmailDto,
  EditUserDto,
} from './dto/update-user.dto';
import { JwtService } from '@nestjs/jwt';
import { TopFollowerDto } from './dto/top-followers.dto';
import { Relation, RelationDocument } from 'src/relation/relation.schema';
import { Post, PostDocument } from 'src/post/post.schema';

@Injectable()
export class UserService {
  private mailer: nodemailer.Transporter;
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    @InjectModel(Relation.name) private readonly relationModel: Model<RelationDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
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
    console.log('[getUserById] Called with userId:', userId);

    const user = await this.userModel.findById(userId).lean();
    console.log('[getUserById] Fetched user:', user);

    if (!user) {
      console.warn('[getUserById] User not found!');
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
      if (value !== undefined && key !== 'password') {
        // Add check to exclude password
        update[key] = value;
      }
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

  // *************** ADMIN-ONLY APIS *******************

async getTopFollowers(limit = 3): Promise<TopFollowerDto[]> {
  console.log('=== Starting corrected getTopFollowers ===');
  
  const docs = await this.relationModel.aggregate([
    // Match all relations that contain follow relationships
    {
      $match: {
        $or: [
          { relation: { $regex: /^FOLLOW_/ } }, // userOne follows someone
          { relation: { $regex: /_FOLLOW$/ } }  // someone follows userOne
        ]
      }
    },
    
    // We need to handle multiple cases and potentially create multiple records
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
    
    // Sort and limit
    { $sort: { followerCount: -1 } },
    { $limit: limit },
    
    // Lookup user details
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userDetails'
      }
    },
    { $unwind: '$userDetails' },
    
    // Shape final output
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

  async verifyFollowerCount(userId: string): Promise<any> {
    console.log(`=== Verifying follower count for user: ${userId} ===`);
    
    const userObjectId = new Types.ObjectId(userId);
    
    // Method 1: Using your working MongoDB shell logic
    const followerCount = await this.relationModel.countDocuments({
      $or: [
        { userTwoID: userObjectId, relation: { $regex: /^FOLLOW_/ } },
        { userOneID: userObjectId, relation: { $regex: /_FOLLOW$/ } }
      ]
    });
    
    console.log(`Follower count using shell logic: ${followerCount}`);
    
    // Method 2: Get the actual follower details
    const followers = await this.relationModel.aggregate([
      {
        $match: {
          $or: [
            { userTwoID: userObjectId, relation: { $regex: /^FOLLOW_/ } },
            { userOneID: userObjectId, relation: { $regex: /_FOLLOW$/ } }
          ]
        }
      },
      {
        $project: {
          followerId: {
            $cond: {
              if: { $eq: ["$userTwoID", userObjectId] },
              then: "$userOneID", 
              else: "$userTwoID"
            }
          },
          relation: 1
        }
      }
    ]);
    
    console.log(`Followers details:`, JSON.stringify(followers, null, 2));
    
    return {
      userId,
      followerCount,
      followers
    };
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
}
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import { User, UserDocument } from './user.schema';
import { v4 as uuidv4 } from 'uuid';
import { RegisterDto } from './dto/register.dto';
import {
  ChangeEmailDto,
  ChangePasswordDTO,
  ConfirmEmailDto,
  EditUserDto,
  SendVerificationCodeDto,
  VerifyCodeDto,
} from './dto/update-user.dto';
import { JwtService } from '@nestjs/jwt';
import { QueryDto } from './dto/user.dto';

@Injectable()
export class UserService {
  private mailer: nodemailer.Transporter;
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
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

  private readonly PASSWORD_LENGTH = 3;
  private readonly PASSWORD_SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;\':",./<>?`~';
  private isStrongPassword = (password: string) => {
    if (password.length < this.PASSWORD_LENGTH) {
      return { valid: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' };
    }
    if (!/[a-z]/.test(password)) {
      return {
        valid: false,
        message: 'Mật khẩu phải chứa ít nhất một chữ thường',
      };
    }
    if (!/[A-Z]/.test(password)) {
      return {
        valid: false,
        message: 'Mật khẩu phải chứa ít nhất một chữ hoa',
      };
    }
    if (!/\d/.test(password)) {
      return { valid: false, message: 'Mật khẩu phải chứa ít nhất một số' };
    }
    if (!/[\W_]/.test(password)) {
      return {
        valid: false,
        message: `Mật khẩu phải chứa ít nhất một ký tự đặc biệt (${this.PASSWORD_SPECIAL_CHARS})`,
      };
    }
    return {
      valid: true,
      message: '',
    };
  };

  async findById(id: string) {
    return this.userModel
      .findById(id)
      .select('_id handleName username profilePic role fcmToken');
  }

  async register(registerDto: RegisterDto): Promise<User> {
    const { email, password, profilePic } = registerDto;
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng');
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
      deletedAt: false,
      profilePic:
        profilePic ||
        'https://i.pinimg.com/736x/3c/67/75/3c67757cef723535a7484a6c7bfbfc43.jpg',
    });

    return newUser.save();
  }

  async findUserIdByHandleName(
    handleName: string,
  ): Promise<{ userId: string }> {
    const user = await this.userModel.findOne({
      handleName,
      deletedAt: { $ne: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy User');
    }

    return { userId: user._id.toString() };
  }

  async getUserById(
    userId: string,
  ): Promise<(Partial<User> & { _id: string }) | null> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      throw new NotFoundException('Không tìm thấy User.');
    }
    const { password, refreshToken, fcmToken, ...safeUser } = user;
    return {
      ...safeUser,
      _id: safeUser._id.toString(),
    };
  }

  async findManyByIds(
    ids: string[],
  ): Promise<(Partial<User> & { _id: string })[]> {
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    const users = await this.userModel.find({ _id: { $in: objectIds } }).lean();

    return users.map((u) => {
      const { password, refreshToken, fcmToken, ...safe } = u;
      return {
        ...safe,
        _id: safe._id.toString(),
      };
    });
  }

  async validateRefreshToken(userId: string, token: string): Promise<boolean> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      throw new NotFoundException('Không tìm thấy User');
    }
    return user.refreshToken === token;
  }

  async logout(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy User');
    }
    user.refreshToken = '';
    user.fcmToken = '';
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
      throw new NotFoundException('Không tìm thấy User');
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
      throw new NotFoundException('Không tìm thấy User');
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
    currentUserId?: string,
  ): Promise<{ items: Partial<User>[]; totalCount: number }> {
    // build the 'match' stage based on mode
    const matchStage: Record<string, any> = { deletedAt: { $eq: false } };

    // exclude the current user
    if (currentUserId) {
      matchStage._id = { $ne: new Types.ObjectId(currentUserId) };
    }

    if (mode === 'username') {
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
        matchStage.$and = andClauses;
      } else if (tokens.length === 1) {
        const single = tokens[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        matchStage.username = { $regex: single, $options: 'i' };
      }
    } else {
      const searchKey = keyword.replace(/\s+/g, '').toLowerCase();
      matchStage.handleName = {
        $regex: searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
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
      if (key === 'wantNotified' && typeof value === 'boolean') {
        update.wantNotified = value;
      }
      if (key === 'fcmToken' && typeof value === 'string') {
        update.fcmToken = value;
      }
    }

    // handleName uniqueness check if provided
    if (dto.handleName) {
      const existingUser = await this.userModel.findOne({
        handleName: { $regex: new RegExp(`^${dto.handleName}$`, 's') },
        _id: { $ne: userId }, // exclude current user
      });

      if (existingUser) {
        throw new BadRequestException('Handlename đã được dùng.');
      }

      update.handleName = dto.handleName;
    }

    // handle password change if provided
    if (dto.password) {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('Không tìm thấy User');
      }
      // check if new password is same as current
      const isSame = await bcrypt.compare(dto.password, user.password);
      if (isSame) {
        throw new BadRequestException(
          'Mật khẩu mới phải khác mật khẩu hiện tại.',
        );
      }
      // hash new password and add it to update object
      update.password = await bcrypt.hash(dto.password, 10);
    }

    // ensure there is something to update
    if (Object.keys(update).length === 0) {
      throw new BadRequestException('Không có thông tin hợp lệ để chỉnh sửa.');
    }

    const updated = await this.userModel
      .findByIdAndUpdate(userId, { $set: update }, { new: true })
      .lean();

    if (!updated) {
      throw new NotFoundException('Không tìm thấy User');
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
      throw new ConflictException('Email đã được sử dụng.');
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
      throw new NotFoundException('Không tìm thấy User');
    }
  }

  async disableUser(userId: string): Promise<boolean> {
    const user = await this.userModel
      .findById(userId)
      .select('deletedAt')
      .exec();
    if (!user) {
      throw new NotFoundException(`Không tìm thấy User ${userId}`);
    }

    const newState = !user.deletedAt;
    user.deletedAt = newState;
    await user.save();

    return newState;
  }

  async getNewUsersByDate(
    from: Date,
    to: Date,
    page = 1,
    limit = 20,
  ): Promise<{
    items: Partial<UserDocument>[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      limit: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    // Build base filter
    const filter = {
      createdAt: { $gte: from, $lte: to },
      role: { $ne: 'admin' },
    };

    // Count total
    const totalCount = await this.userModel.countDocuments(filter);
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);

    // Fetch paged items, excluding private fields
    const items = await this.userModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-password -refreshToken -fcmToken -isVip -wantNotified')
      .lean()
      .exec();

    return {
      items,
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

  async changePassword(userId: string, body: ChangePasswordDTO) {
    const currentUser = await this.userModel.findById(userId).exec();
    if (!currentUser) {
      return {
        message: 'Failed',
        error: 'Không tìm thấy người dùng',
      };
    }

    const isCurrentPasswordCorrect = bcrypt.compareSync(
      body.currentPassword,
      currentUser.password,
    );

    if (!isCurrentPasswordCorrect) {
      return {
        message: 'Failed',
        error: 'Sai mật khẩu hiện tại',
      };
    }

    const hasStrongPas = this.isStrongPassword(body.newPassword);
    if (!hasStrongPas.valid) {
      return {
        message: hasStrongPas.message,
        data: '',
      };
    }

    await this.userModel
      .findByIdAndUpdate(userId, {
        password: bcrypt.hashSync(body.newPassword, 10),
      })
      .exec();

    const { password, ...rest } = currentUser.toObject();

    return {
      message: 'Success',
      data: rest,
    };
  }

  // step 1: check if user
  async checkUserForPasswordReset(
    email: string,
  ): Promise<{ hasPhoneNumber: boolean }> {
    const user = await this.userModel.findOne({ email }).lean();

    if (!user || user.deletedAt) {
      throw new NotFoundException('Không tìm thấy tài khoản với email này.');
    }

    if (user.isGoogle) {
      throw new BadRequestException(
        'Tài khoản này được đăng ký bằng Google và không sử dụng mật khẩu. Vui lòng đăng nhập bằng Google.',
      );
    }

    return {
      hasPhoneNumber: !!user.phoneNumber,
    };
  }

  // step 2: send verification code
  async sendPasswordResetCode(
    dto: SendVerificationCodeDto,
  ): Promise<{ token: string }> {
    const { email, phoneNumber } = dto;

    const user = await this.userModel.findOne({ email });

    if (!user || user.deletedAt) {
      throw new NotFoundException('Không tìm thấy tài khoản với email này.');
    }

    if (user.isGoogle) {
      throw new BadRequestException(
        'Tài khoản này được đăng ký bằng Google và không sử dụng mật khẩu.',
      );
    }

    let finalPhoneNumber = user.phoneNumber;

    // If user doesn't have phone number, we need to add it
    if (!user.phoneNumber) {
      if (!phoneNumber) {
        throw new BadRequestException(
          'Vui lòng cung cấp số điện thoại để tiếp tục.',
        );
      }

      // Check if phone number is already used by another user
      const existingPhoneUser = await this.userModel
        .findOne({
          phoneNumber,
          _id: { $ne: user._id }, // Exclude current user
        })
        .lean();

      if (existingPhoneUser) {
        throw new ConflictException(
          'Số điện thoại này đã được sử dụng bởi tài khoản khác.',
        );
      }

      // Save phone number to user
      user.phoneNumber = phoneNumber;
      await user.save();
      finalPhoneNumber = phoneNumber;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Send SMS
    const smsPayload = {
      ApiKey: process.env.SMS_API_KEY,
      SecretKey: process.env.SMS_SECRET_KEY,
      Phone: finalPhoneNumber,
      Content: `${code} la ma xac minh dang ky Baotrixemay cua ban`,
      Brandname: 'Baotrixemay',
      SmsType: '2',
    };

    try {
      await firstValueFrom(
        this.httpService.post(
          'https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/',
          smsPayload,
        ),
      );
    } catch (error) {
      throw new BadRequestException(
        'Không thể gửi mã xác nhận. Vui lòng thử lại sau.',
      );
    }

    // Create token with email and code
    const token = this.jwtService.sign(
      { email, code },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );

    return { token };
  }

  // step 3: verify code and generate refresh token
  async verifyPasswordResetCode(
    dto: VerifyCodeDto,
  ): Promise<{ refreshToken: string }> {
    let payload: { email: string; code: string };

    try {
      payload = this.jwtService.verify(dto.token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn.');
    }

    if (payload.code !== dto.code) {
      throw new BadRequestException('Mã xác nhận không đúng.');
    }

    // Find user by email
    const user = await this.userModel.findOne({ email: payload.email });

    if (!user || user.deletedAt) {
      throw new NotFoundException(
        'Tài khoản không hợp lệ hoặc đã bị vô hiệu hóa.',
      );
    }

    // Create refresh token
    const refreshPayload = { sub: user._id.toString() };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    return { refreshToken };
  }

  async validateUser(
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if userId is a valid ObjectId
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException({
          success: false,
          message: 'ID người dùng không hợp lệ',
        });
      }

      // Check if user exists in database
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException({
          success: false,
          message: 'Không tìm thấy người dùng',
        });
      }

      // Check if user is not deleted
      if (user.deletedAt) {
        throw new NotFoundException({
          success: false,
          message: 'Người dùng đã bị xóa',
        });
      }

      // All checks passed
      return {
        success: true,
        message: 'Người dùng hợp lệ',
      };
    } catch (error) {
      // If it's already a NestJS exception, re-throw it
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Handle any other unexpected errors
      throw new BadRequestException({
        success: false,
        message: 'Đã xảy ra lỗi khi xác thực người dùng',
      });
    }
  }

  async aggregateUsers({ q, status, from, to, page, pageSize }: QueryDto) {
    const match: Record<string, any> = {};

    if (q?.trim()) {
      const rx = new RegExp(this.escapeRegex(q.trim()), 'i');
      match.$or = [
        { username: rx },
        { email: rx },
        { phoneNumber: rx },
        { handleName: rx },
      ];
    }
    if (status === 'active') match.deletedAt = false;
    if (status === 'locked') match.deletedAt = true;

    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) match.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    const sortStage: PipelineStage.Sort = { $sort: { createdAt: -1 } };
    const skip = (page - 1) * pageSize;
    const limit = pageSize;

    const items: PipelineStage[] = [
      { $match: match },
      sortStage,
      { $skip: skip },
      { $limit: limit },

      // POSTS
      {
        $lookup: {
          from: 'posts',
          let: { uid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userID', '$$uid'] },
                    { $eq: ['$isEnable', true] },
                  ],
                },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: 'posts',
        },
      },
      {
        $addFields: { totalPosts: { $size: '$posts' }, postIds: '$posts._id' },
      },

      // POST LIKES
      {
        $lookup: {
          from: 'postlikes',
          let: { pids: '$postIds' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $gt: [{ $size: { $ifNull: ['$$pids', []] } }, 0] },
                    { $in: ['$postId', '$$pids'] },
                  ],
                },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: 'postLikesArr',
        },
      },
      { $addFields: { postLikes: { $size: '$postLikesArr' } } },

      // STORIES
      {
        $lookup: {
          from: 'stories',
          let: { uid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$ownerId', '$$uid'] },
                    { $eq: ['$isEnable', true] },
                    { $eq: ['$isArchived', false] },
                  ],
                },
              },
            },
            { $project: { likedByUsers: 1 } },
          ],
          as: 'stories',
        },
      },
      {
        $addFields: {
          totalStories: { $size: '$stories' },
          storyLikes: {
            $sum: {
              $map: {
                input: '$stories',
                as: 's',
                in: { $size: { $ifNull: ['$$s.likedByUsers', []] } },
              },
            },
          },
        },
      },

      // FOLLOWERS (2 chiều)
      {
        $lookup: {
          from: 'relations',
          let: { me: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    // Tôi là userOneID và tôi FOLLOW
                    {
                      $and: [
                        { $eq: ['$userOneID', '$$me'] },
                        {
                          $in: [
                            '$relation',
                            ['FOLLOW_NULL', 'FOLLOW_FOLLOW', 'FOLLOW_BLOCK'],
                          ],
                        },
                      ],
                    },
                    // Tôi là userTwoID và tôi FOLLOW
                    {
                      $and: [
                        { $eq: ['$userTwoID', '$$me'] },
                        {
                          $in: [
                            '$relation',
                            ['NULL_FOLLOW', 'FOLLOW_FOLLOW', 'BLOCK_FOLLOW'],
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: 'relsFollowing',
        },
      },
      { $addFields: { totalFollowing: { $size: '$relsFollowing' } } },

      // BOOKMARKS
      {
        $lookup: {
          from: 'bookmarkplaylists',
          let: { me: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userID', '$$me'] },
                    { $eq: ['$isDeleted', false] },
                  ],
                },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: 'playlists',
        },
      },
      {
        $lookup: {
          from: 'bookmarkitems',
          let: { pids: '$playlists._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ['$playlistID', { $ifNull: ['$$pids', []] }] },
                    { $eq: ['$isDeleted', false] },
                  ],
                },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: 'bmItems',
        },
      },
      { $addFields: { totalBookmarks: { $size: '$bmItems' } } },

      // Map & cleanup
      {
        $addFields: {
          phone: '$phoneNumber',
          avatar: '$profilePic',
          status: {
            $cond: [{ $eq: ['$deletedAt', true] }, 'locked', 'active'],
          },
          totalLikesReceived: { $add: ['$storyLikes', '$postLikes'] },
        },
      },
      {
        $project: {
          posts: 0,
          postIds: 0,
          postLikesArr: 0,
          stories: 0,
          rels: 0,
          playlists: 0,
          bmItems: 0,
          phoneNumber: 0,
          profilePic: 0,
          refreshToken: 0,
          fcmToken: 0,
          role: 0,
          wantNotified: 0,
          isGoogle: 0,
          password: 0,
          deletedAt: 0,
          storyLikes: 0,
          postLikes: 0,
        },
      },
    ];

    const total = [
      { $match: match },
      { $count: 'count' },
    ] as unknown as PipelineStage.FacetPipelineStage[];

    const pipeline: PipelineStage[] = [
      { $facet: { items, total } as any },
      {
        $project: {
          items: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
        },
      },
    ];

    const [res] = await this.userModel.aggregate(pipeline).allowDiskUse(true);
    return { items: res?.items ?? [], total: res?.total ?? 0 };
  }

  private escapeRegex(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

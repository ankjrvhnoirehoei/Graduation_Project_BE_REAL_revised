import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  UnauthorizedException,
  Req,
  Query,
  ConflictException,
  Param,
  DefaultValuePipe,
  ParseIntPipe,
  BadRequestException,
  Patch,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { UserService } from './user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from 'src/auth/dto/login.dto';
import { AuthService } from 'src/auth/auth.service';
import {
  JwtAuthGuard,
  JwtRefreshAuthGuard,
} from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtService } from '@nestjs/jwt';
import { RelationService } from 'src/relation/relation.service';
import { SearchUserDto } from './dto/search-user.dto';
import { ChangeEmailDto, ConfirmEmailDto, EditUserDto } from './dto/update-user.dto';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly relationService: RelationService,
  ) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    await this.userService.register(registerDto);
    return { message: 'Register successful' };
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const { email, password } = loginDto;
    const tokens = await this.authService.login(email, password);
    return {
      message: 'Login successful',
      ...tokens,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser('sub') userId: string) {
    console.log('[GET /users/me] userId from token:', userId);

    const user = await this.userService.getUserById(userId);
    console.log('[GET /users/me] user from DB:', user);
    return user;
  }

  @Post('check-refresh-token')
  @UseGuards(JwtRefreshAuthGuard)
  async checkRefreshToken(@CurrentUser('sub') userId: string, @Req() req: any) {
    const authHeader =
      req.headers['authorization'] || req.headers.authorization;
    const tokenFromClient = authHeader?.replace('Bearer ', '');
    if (!tokenFromClient) {
      throw new UnauthorizedException('No token provided');
    }
    const isValid = await this.userService.validateRefreshToken(
      userId,
      tokenFromClient,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return { valid: true, message: 'Token is valid' };
  }

  @Post('logout')
  @UseGuards(JwtRefreshAuthGuard)
  async logout(@CurrentUser('sub') userId: string) {
    await this.userService.logout(userId);
    return { message: 'Logout successful' };
  }

  @Post('check-email')
  async checkEmail(@Body('email') email: string): Promise<{ exists: boolean }> {
    if (!email) {
      throw new ConflictException('Email is required');
    }
    const exists = await this.userService.checkEmailExists(email);
    return { exists };
  }

  @UseGuards(JwtRefreshAuthGuard)
  @Post('refresh-access-token')
  async refresh(
    @CurrentUser('sub') userId: string,
    @Req() req: any,
  ): Promise<{ accessToken: string }> {
    const authHeader = req.headers['authorization'] || req.headers.authorization;
    const tokenFromClient = authHeader?.replace('Bearer ', '');
    if (!tokenFromClient) {
      throw new UnauthorizedException('No refresh token provided');
    }

    // verify that this refresh token matches what's stored in the DB
    const isValid = await this.userService.validateRefreshToken(
      userId,
      tokenFromClient,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // since it's valid, issue a brand‐new access token:
    // read the payload from the validated refresh token; 
    const payload = { sub: userId };

    const newAccessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
    });

    // const newRefreshToken = await this.jwtService.signAsync(payload, {
    //   secret: process.env.JWT_REFRESH_SECRET,
    //   expiresIn: '7d',
    // });
    // await this.userService.updateRefreshToken(userId, newRefreshToken);

    return { accessToken: newAccessToken };
  }

  // get a user's public profile
  @UseGuards(JwtRefreshAuthGuard)
  @Get('public/:id')
  async getPublicProfile(
    @CurrentUser('sub') currentUserId: string,
    @Param('id') targetUserId: string,
  ) {
    // fetch the bare public profile fields
    const baseProfile = await this.userService.getPublicProfile(targetUserId);

    // if the current user is asking about themselves, just default to false:
    let userFollowing = false;
    let userBlocked = false;
    if (currentUserId !== targetUserId) {
      // call RelationService.getRelation(...) to see if there's a follow edge:
      const { relation, userOneIsActing } =
        await this.relationService.getRelation(currentUserId, targetUserId);

      if (relation) {
        // relation is something like 'FOLLOW_NULL', 'NULL_FOLLOW', 'FOLLOW_FOLLOW', etc.
        const [oneRel, twoRel] = (relation as string).split('_'); // [ 'FOLLOW', 'NULL' ] etc.

        if (userOneIsActing) {
          // currentUserId is “userOne” in the lex order
          userFollowing = oneRel === 'FOLLOW';
          userBlocked = oneRel === 'BLOCK';
        } else {
          // currentUserId is “userTwo” in the lex order
          userFollowing = twoRel === 'FOLLOW';
          userBlocked = twoRel === 'BLOCK';
        }
      }
    }

    return {
      ...baseProfile,
      userFollowing,
      userBlocked
    };
  }

  @Post('search')
  @UseGuards(JwtRefreshAuthGuard)
  async searchUsers(
    @CurrentUser('sub') currentUserId: string,
    @Body() { keyword, mode }: SearchUserDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const trimmed = keyword.trim();
    if (!trimmed) {
      throw new BadRequestException('Keyword must not be empty');
    }
    const { items: rawUsers, totalCount } =
      await this.userService.searchUsersRawPaginated(
        trimmed,
        mode,
        page,
        limit,
      );

    // same following-follower relationship like before
    const enriched = await Promise.all(
      rawUsers.map(async (usr) => {
        const targetId = (usr as any)._id.toString();
        let userFollowing = false;

        if (currentUserId !== targetId) {
          const { relation, userOneIsActing } =
            await this.relationService.getRelation(currentUserId, targetId);

          if (relation) {
            const [oneRel, twoRel] = (relation as string).split('_');
            if (userOneIsActing) {
              userFollowing = oneRel === 'FOLLOW';
            } else {
              userFollowing = twoRel === 'FOLLOW';
            }
          }
        }

        return {
          _id: (usr as any)._id,
          username: (usr as any).username,
          phoneNumber: (usr as any).phoneNumber || '',
          handleName: (usr as any).handleName,
          bio: (usr as any).bio || '',
          address: (usr as any).address || '',
          gender: (usr as any).gender || '',
          profilePic:
            (usr as any).profilePic ||
            'https://i.pinimg.com/736x/3c/67/75/3c67757cef723535a7484a6c7bfbfc43.jpg',
          isVip: (usr as any).isVip || false,
          userFollowing,
        };
      }),
    );

    // compute pagination metadata
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const pagination = {
      currentPage: page,
      totalPages,
      totalCount,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return {
      message: 'Searched results retrieved successfully',
      users: {
        items: enriched,
        pagination,
      },
    };
  }

  @Patch('edit-me')
  @UseGuards(JwtRefreshAuthGuard)
  async editMe(
    @CurrentUser('sub') userId: string,
    @Body() dto: EditUserDto,
  ) {
    const updated = await this.userService.updateProfile(userId, dto);
    return { message: 'Profile updated', user: updated };
  }

  // email change: send code + return token 
  @Post('email/init-change')
  @UseGuards(JwtRefreshAuthGuard)
  async initiateEmailChange(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangeEmailDto,
  ) {
    const { token } = await this.userService.initiateEmailChange(userId, dto);
    return { message: 'Confirmation code sent', token };
  }

  // confirm email change using token + code 
  @Post('email/confirm-new')
  @UseGuards(JwtRefreshAuthGuard)
  async confirmEmailChange(
    @CurrentUser('sub') userId: string,
    @Body() dto: ConfirmEmailDto,
  ) {
    await this.userService.confirmEmailChange(userId, dto);
    return { message: 'Email updated successfully' };
  }  
  
  @Get('admin/all')
  async getAllUsersForAdmin(
    @Res() res: Response,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('sort') sort?: string,    
  ) {
    
    // sanitize inputs
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 10;

    // parse and validate sort parameter
    let sortField = 'createdAt';
    let sortOrder: 1 | -1 = -1; // default: newest first

    if (sort) {
      // Handle formats like "username:asc", "email:desc", or just "username"
      const [field, order] = sort.split(':');
      const allowedFields = ['username', 'email', 'handleName', 'gender', 'createdAt', 'updatedAt', 'deletedAt'];
      
      if (allowedFields.includes(field)) {
        sortField = field;
        sortOrder = order === 'asc' ? 1 : -1;
      }
    }

    // fetch users + total count
    const { users, pagination } = await this.userService.getAllUsers(page, limit, sortField, sortOrder);
    const total = pagination.totalUsers;

    // compute the range indexes
    const start = (page - 1) * limit;
    const end = start + users.length - 1;

    // users is an array of plain objects from `.lean()`
    const usersWithId = users.map(user => ({
      ...user,
      id: user._id,          // add `id` for React-Admin
    }));

    // set headers for React-Admin pagination
    const resource = 'users/admin/all';
    res.setHeader('Content-Range', `${resource} ${start}-${end}/${total}`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');

    // send only the array
    return res.json(usersWithId);
  }

  @Get('admin/:id')
  async getUserByIdForAdmin(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    // Validate MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const user = await this.userService.getUserByIdForAdmin(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Add id field for React-Admin compatibility
    const userWithId = {
      ...user,
      id: user._id,
    };

    // Set headers for React-Admin
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
    
    return res.json(userWithId);
  }
}

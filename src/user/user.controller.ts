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
  ValidationPipe,
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
import { ChangeEmailDto, ChangePassword, ConfirmEmailDto, EditUserDto } from './dto/update-user.dto';
import { TopFollowerDto } from './dto/top-followers.dto';

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

  @Patch('password')
  @UseGuards(JwtRefreshAuthGuard)
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body(new ValidationPipe()) body: ChangePassword,
  ) {
    return this.userService.changePassword(userId, body);
  }

  @Post('fcm-token')
  async updateFcmToken(@Body() body: { userId: string; fcmToken: string }) {
    const { userId, fcmToken } = body;
    await this.userService.findByIdAndUpdate(userId, { fcmToken });
    return { message: 'FCM token saved' };
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
  
  /*======================== ADMIN-ONLY ========================*/

  @Get('admin/top-followers')
  @UseGuards(JwtRefreshAuthGuard)
  async topFollowers(@CurrentUser('sub') userId: string): Promise<TopFollowerDto[]> {
    const user = await this.userService.findById(userId);
    if (!user || typeof user.role !== 'string') {
      throw new BadRequestException('User role not found.');
    }
    if (user.role !== 'admin') {
      throw new BadRequestException('Access denied: Admins only.');
    }    
    return this.userService.getTopFollowers(3);
  }

  @Get('admin/today-stats')
  @UseGuards(JwtRefreshAuthGuard)
  async todayStats(@CurrentUser('sub') userId: string) {
    const user = await this.userService.findById(userId);
    if (!user || typeof user.role !== 'string') {
      throw new BadRequestException('User role not found.');
    }
    if (user.role !== 'admin') {
      throw new BadRequestException('Access denied: Admins only.');
    }    
    return this.userService.getTodayStats();
  }

  @Get('admin/stats/new-accounts')
  @UseGuards(JwtRefreshAuthGuard)
  async getDailyNewAccounts(
    @CurrentUser('sub') userId: string,
    @Query('month', ParseIntPipe) month: number,
  ): Promise<{ month: string; data: { day: number; count: number }[] }> {
    const user = await this.userService.findById(userId);
    if (!user || user.role !== 'admin') {
      throw new BadRequestException('Access denied: Admins only.');
    }
    return this.userService.getDailyNewAccounts(month);
  }  

  @Get('admin/search')
  @UseGuards(JwtRefreshAuthGuard)
  async adminSearchUser(
    @CurrentUser('sub') userId: string,
    @Query('keyword') keyword: string,
  ) {
    const user = await this.userService.findById(userId);
    if (!user || user.role !== 'admin') {
      throw new BadRequestException('Access denied: Admins only.');
    }
    return this.userService.getUserWithInteractions(keyword);
  }

  @Get('admin/recommended')
  @UseGuards(JwtRefreshAuthGuard)
  async getRecommended(
    @CurrentUser('sub') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const user = await this.userService.findById(userId);
    if (!user || user.role !== 'admin') {
      throw new BadRequestException('Access denied: Admins only.');
    }
    return this.userService.getRecommendedUsers(page, limit);
  }  
}

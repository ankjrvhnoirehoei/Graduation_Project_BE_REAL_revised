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
} from '@nestjs/common';
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
        } else {
          // currentUserId is “userTwo” in the lex order
          userFollowing = twoRel === 'FOLLOW';
        }
      }
    }

    return {
      ...baseProfile,
      userFollowing,
    };
  }
}

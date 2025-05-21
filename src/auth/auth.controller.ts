import {
  Controller, Post, Get, Body, Req, Res, UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from '../user/dto/signup.dto';
import { LoginDto } from '../user/dto/login.dto';
import { JwtAuthGuard, JwtRefreshGuard } from '@app/common';
import { UserDocument } from 'src/user/user.schema';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('signup')
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.userService.signup(dto);
    const { accessToken, refreshToken } = await this.auth.issueTokens(user);
    res.cookie('Authentication', accessToken, this.auth.getCookieOptions());
    res.cookie('Refresh', refreshToken, {
      ...this.auth.getCookieOptions(),
      path: '/auth/refresh',
    });
    const { password, refreshToken: _, ...rest } = user.toObject();
    return rest;
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.validateUser(dto.email, dto.password);
    const { accessToken, refreshToken } = await this.auth.issueTokens(user);
    res.cookie('Authentication', accessToken, this.auth.getCookieOptions());
    res.cookie('Refresh', refreshToken, {
      ...this.auth.getCookieOptions(),
      path: '/auth/refresh',
    });
    // const { password, refreshToken: _, ...rest } = user.toObject();
    return;
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const incoming = req.cookies.Refresh;
    const { userId } = req.user as any;
    const tokens = await this.auth.refreshTokens(userId, incoming);
    res.cookie('Authentication', tokens.accessToken, this.auth.getCookieOptions());
    res.cookie('Refresh', tokens.refreshToken, {
      ...this.auth.getCookieOptions(),
      path: '/auth/refresh',
    });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    console.log('cookies: ', req.cookies);
    console.log('req.user: ', req.user);
    const user = req.user as UserDocument;
    console.log('user: ', user);
    if (!user) throw new UnauthorizedException('User not found');
    const { password, refreshToken: _, ...rest } = user.toObject();
    return rest;
  }
}
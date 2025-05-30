import {
  Controller, Post, Get, Body, Req, Res, UseGuards, Put,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from '../user/dto/signup.dto';
import { LoginDto } from '../user/dto/login.dto';
import { JwtAuthGuard, JwtRefreshGuard } from '@app/common';
import { UserDocument } from 'src/user/user.schema';
import { ForgotPasswordDto } from './dto/forgot.password.dto';
import { ConfirmForgotDto } from './dto/confirm.password.dto';
import * as bcrypt from 'bcrypt';

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
    res.cookie('Refresh', refreshToken, this.auth.getCookieOptions());
    const { password, refreshToken: _, ...rest } = user.toObject();
    return rest;
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.userService.findOneByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    // if soft-deleted, short-circuit with recovery info
    if (user.deletedAt) {
      const now = new Date();
      const deletedAt = user.deletedAt;
      const ms = now.getTime() - deletedAt.getTime();
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      const isRetrievable = days < 30;

      // (Optionally, hard-delete if more than 30 days have passed)
      // if (!isRetrievable) {
      //   await this.auth.userService.permanentDelete(user.id.toString());
      //   return { message: 'Account is permanently deleted' };
      // }

      return {
        deleted: true,
        daysSinceDeletion: days,
        isRetrievable,
        id: user.id.toString(),
      };
    }

    // now proceed with normal validate + issueTokens
    await this.auth.validateUser(dto.email, dto.password);

    // detect same-device
    const incoming = req.cookies?.Refresh;
    let sameDevice = false;
    if (incoming && user.refreshToken && user.currentSessionId) {
      const tokenMatches = await bcrypt.compare(incoming, user.refreshToken);
      if (tokenMatches) {
        const decoded: any = this.auth.jwtService.decode(incoming);
        if (decoded?.sessionId === user.currentSessionId) {
          sameDevice = true;
        }
      }
    }

    const { accessToken, refreshToken } = await this.auth.issueTokens(user);
    res.cookie('Authentication', accessToken, this.auth.getCookieOptions());
    res.cookie('Refresh', refreshToken, this.auth.getCookieOptions());
    // const { password, refreshToken: _, ...rest } = user.toObject();
    return {sameDevice};
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const incoming = req.cookies.Refresh;
    const { userId } = req.user as any;
    const newAccessToken = await this.auth.validateRefreshToken(userId, incoming);
    res.cookie('Authentication', newAccessToken, this.auth.getCookieOptions());
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
    const { password, _id, refreshToken: _, ...rest } = user.toObject();
    return rest;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user as any;
    // Clear refresh token in database
    await this.auth.clearRefreshToken(user.sub);
    await this.auth.clearSession(user.sub);
    // Clear cookies
    const cookieOpts = this.auth.getCookieOptions();
    res.clearCookie('Authentication', cookieOpts);
    res.clearCookie('Refresh', cookieOpts);

    return { success: true };
  }

  @Put('forgot-password')
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ) {
    await this.auth.initiatePasswordReset(dto.email, dto.newPassword);
    return { message: 'Confirmation code sent to email' };
  }

  @Put('confirm-password')
  async confirmForgotPassword(
    @Body() dto: ConfirmForgotDto,
  ) {
    await this.auth.confirmPasswordReset(dto.email, dto.code);
    return { message: 'Password updated successfully' };
  }
}
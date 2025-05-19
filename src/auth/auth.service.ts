import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { UserDocument } from '../user/user.schema';

@Injectable()
export class AuthService {
  constructor(
    readonly userService: UserService,
    readonly jwtService: JwtService,
  ) {}

  private cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };

  async issueTokens(user: any) {
    const payload = { sub: user._id.toString(), email: user.email };
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    // save hashed refresh token
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.userService.setRefreshTokenHash(user._id, hash);

    return { accessToken, refreshToken };
  }

  async validateUser(email: string, pass: string): Promise<UserDocument> {
    const user = await this.userService.findOneByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.deletedAt) throw new UnauthorizedException('Account unavailable');
    const valid = await bcrypt.compare(pass, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async refreshTokens(userId: string, incoming: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.refreshToken) throw new UnauthorizedException('No session');
    const match = await bcrypt.compare(incoming, user.refreshToken);
    if (!match) throw new UnauthorizedException('Invalid refresh token');
    return this.issueTokens(user);
  }

  getCookieOptions() {
    return this.cookieOptions;
  }
}
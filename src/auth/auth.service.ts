import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer'; 
import { UserService } from '../user/user.service';
import { UserDocument } from '../user/user.schema';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  private readonly cookieOptions: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax';
    path: string;
  };
  private readonly transporter;

  constructor(
    readonly userService: UserService,
    readonly jwtService: JwtService,
    readonly configService: ConfigService,
  ) {
    this.cookieOptions = {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  async issueTokens(user: any) {
    const payload = { sub: user._id.toString(), email: user.email };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    // save hashed refresh token
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.userService.setRefreshTokenHash(user._id, hash);

    return { accessToken, refreshToken };
  }

  async issueAccessToken(user: any) {
    const payload = { sub: user._id.toString(), email: user.email };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });
    return accessToken;
  }

  async validateUser(email: string, pass: string): Promise<UserDocument> {
    const user = await this.userService.findOneByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.deletedAt) throw new UnauthorizedException('Account unavailable');
    const valid = await bcrypt.compare(pass, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async validateRefreshToken(userId: string, incoming: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.refreshToken) throw new UnauthorizedException('No session');
    const match = await bcrypt.compare(incoming, user.refreshToken);
    if (!match) throw new UnauthorizedException('Invalid refresh token');
    // issue a new access
    return this.issueAccessToken(user);
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

  async clearRefreshToken(userId: string) {
    return this.userService.setRefreshTokenHash(userId, '');
  }

  async initiatePasswordReset(email: string, newPassword: string) {
    const user = await this.userService.findOneByEmail(email);
    if (!user) throw new UnauthorizedException('User not found');
    if (!this.userService.isValidPassword(newPassword)) {
      throw new UnauthorizedException('Password does not meet complexity requirements');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await this.userService.setResetToken(
      user.id,
      codeHash,
      newPasswordHash,
      expires,
    );

    await this.transporter.sendMail({
      from: this.configService.get('EMAIL_FROM'),
      to: email,
      subject: 'Your password reset code',
      text: `Your confirmation code is ${code}. It expires in 5 minutes.`,
    });
  }

  async confirmPasswordReset(email: string, code: string) {
    const user = await this.userService.findOneByEmail(email);
    if (!user || !user.resetTokenHash || !user.resetTokenExpires || !user.newPasswordHash) {
      throw new UnauthorizedException('No reset request found');
    }
    if (user.resetTokenExpires < new Date()) {
      throw new UnauthorizedException('Reset code expired');
    }
    const match = await bcrypt.compare(code, user.resetTokenHash);
    if (!match) {
      throw new UnauthorizedException('Invalid reset code');
    }
    await this.userService.updatePassword(
      user.id,
      user.newPasswordHash
    );
    await this.userService.clearResetToken(user.id);
  }
}
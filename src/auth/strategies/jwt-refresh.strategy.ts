import { Strategy, ExtractJwt } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService, 
  ) {
    const jwtRefreshSecret = configService.get<string>('JWT_REFRESH_SECRET');
    if (!jwtRefreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        req => req?.cookies?.Refresh,
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtRefreshSecret,
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const user = await this.userService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');

    // sessionId match?
    if (user.currentSessionId !== payload.sessionId) {
      throw new UnauthorizedException('Session invalidated');
    }

    // refresh token hash match?
    const refreshCookie = req?.cookies?.Refresh;
    if (!refreshCookie) throw new UnauthorizedException('Refresh token not found');
    if (!user.refreshToken) {
      throw new UnauthorizedException('User has no refresh token');
    }
  
    const match = await bcrypt.compare(refreshCookie, user.refreshToken);
    if (!match) throw new UnauthorizedException('Invalid refresh token');

    // we only return the needed info
    return { userId: payload.sub, email: payload.email, sessionId: payload.sessionId };
  }
}
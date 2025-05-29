import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { UserService } from '../../user/user.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService, 
  ) {
    const jwtAccessSecret = configService.get<string>('JWT_ACCESS_SECRET');
    if (!jwtAccessSecret) {
      throw new Error('JWT_ACCESS_SECRET is not defined');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        req => req?.cookies?.Authentication,
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtAccessSecret,
    });
  }

async validate(payload: any) {
  const user = await this.userService.findById(payload.sub);
  if (!user) throw new UnauthorizedException('User not found');

  if (user.currentSessionId !== payload.sessionId) {
    throw new UnauthorizedException('Session invalidated');
  }

  return user; 
}
}
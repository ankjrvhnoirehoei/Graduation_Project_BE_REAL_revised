import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  UnauthorizedException,
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

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
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
  async checkRefreshToken(@CurrentUser() userPayload: any) {
    const { sub: userId, refreshToken } = userPayload;
    const isValid = await this.userService.validateRefreshToken(
      userId,
      refreshToken,
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
}

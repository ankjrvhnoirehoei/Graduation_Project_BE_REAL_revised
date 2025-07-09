import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../user/user.schema';
import { Model } from 'mongoose';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
    fcmToken?: string,
  ): Promise<{ message: string; accessToken: string; refreshToken: string; fcmToken?: string }> {
    if (!email) {
      throw new BadRequestException("Vui lòng cung cấp địa chỉ email.");
    }

    if (!password) {
      throw new BadRequestException("Vui lòng cung cấp mật khẩu.");
    }

    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException("Thông tin đăng nhập không hợp lệ.");
    }

    if (user.deletedAt) {
      throw new UnauthorizedException("Tài khoản đã bị vô hiệu hóa hoặc xóa.");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    const isSameHash = password === user.password;

    if (!isMatch && !isSameHash) {
      // Optionally track failed attempts here and lock after N tries
      throw new UnauthorizedException("Thông tin đăng nhập không hợp lệ.");
    }

    const payload = { sub: user._id.toString() };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    user.refreshToken = refreshToken;
    if (fcmToken) {
      user.fcmToken = fcmToken;
    }
    await user.save();

    return {
      message: "Đăng nhập thành công.",
      accessToken,
      refreshToken,
      fcmToken,
    };
  }
}
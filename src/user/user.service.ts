import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { UserDto } from './dto/user.dto';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}
  
  // Helper functions
  async create(userDto: UserDto): Promise<User> {
    const newUser = new this.userModel(userDto);
    return newUser.save();
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find();
  }

  async findOneByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username });
  }

  async findOneByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async setRefreshTokenHash(userId: string, hash: string) {
    return this.userModel.findByIdAndUpdate(userId, { refreshToken: hash });
  }

  async findById(id: string) {
    return this.userModel.findById(id);
  }

  // Singup
  async signup(dto: SignupDto): Promise<UserDocument> {
    const { username, email, password } = dto;

    if (await this.userModel.exists({ email })) {
      throw new ConflictException('Email already in use');
    }

    let handleName = username.trim().toLowerCase().replace(/\s+/g, '');
    // if handleName collision, append 5‑char random alphanumeric
    if (await this.userModel.exists({ handleName })) {
      const rand = Math.random().toString(36).substring(2, 7);
      handleName = `${handleName}${rand}`;
    }

    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);

    const created = new this.userModel({
      username,
      email,
      password: hash,
      handleName,
    });

    return created.save();
  }
}

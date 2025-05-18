import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { UserDto } from './dto/user.sto';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

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
}
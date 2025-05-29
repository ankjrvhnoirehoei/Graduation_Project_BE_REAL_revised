import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { UserDto } from './dto/user.dto';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { EditUserDto } from './dto/edit-user.dto';
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

  async findByIdAndUpdate(userId: string, update: Partial<UserDocument>): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(
      userId,
      update,
      { new: true, runValidators: true }
    ).exec();
  }

  async permanentDelete(userId: string): Promise<void> {
    await this.userModel.findByIdAndDelete(userId).exec();
  }

  async reactivate(userId: string): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $unset: { deletedAt: '' } },
        { new: true },
      )
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async isValidPassword(password: string) {
    if (password.length < 8) return false;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    return hasLetter && hasNumber;
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

  // reset password for forgetting password
  async setResetToken(
    userId: string,
    resetTokenHash: string,
    newPasswordHash: string,
    expires: Date,
  ): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    user.set({
      resetTokenHash,
      newPasswordHash,
      resetTokenExpires: expires,
    });
    await user.save();
  }

  // update the user's password and clear reset-related fields
  async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    user.password = newPasswordHash;
    // Clear reset fields
    user.resetTokenHash = undefined;
    user.newPasswordHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();
  }

  // clears any password reset tokens without changing the password
  async clearResetToken(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    user.resetTokenHash = undefined;
    user.newPasswordHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();
  }

  async findOneByHandle(handleName: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ handleName }).exec();
  }

  // update user
  async updateProfile(
    userId: string,
    dto: EditUserDto,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // assign only the provided fields
    Object.assign(user, dto);
    return user.save();
  }

  // device session to enforce 1 device per user
  async setRefreshSession(userId: string, sessionId: string, hash: string) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { refreshToken: hash, currentSessionId: sessionId }
    );
  }

  // fetch public profile fields, filling missing values with empty strings 
  async getPublicProfile(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    return {
      username: user.username || '',
      phoneNumber: user.phoneNumber || '',
      handleName: user.handleName || '',
      bio: user.bio || '',
      address: user.address || '',
      gender: user.gender || '',
      profilePic: user.profilePic || '',
      isVip: user.isVip,
    };
  }

  // Search users by username (approximate) or handleName (exact), limited to `limit` results 
  async searchUsers(
    mode: 'username' | 'handle',
    keyword: string,
    limit = 50,
  ): Promise<Array<{ id: string; username: string; handleName: string }>> {
    const trimmed = keyword.trim();
    if (mode === 'handle') {
      // substring match on handleName (case-sensitive)
      const users = await this.userModel
        .find({ handleName: { $regex: trimmed } })
        .limit(limit)
        .select('username handleName')
        .exec();
      return users.map(u => ({ id: u.id.toString(), username: u.username, handleName: u.handleName || 'No matched users found.'}));
    }


    // approximate username search
    const isMulti = keyword.includes(' ');
    let filter;
    if (isMulti) {
      // split into words and require all
      const words = keyword.trim().split(/\s+/);
      filter = { $and: words.map(w => ({ username: { $regex: w, $options: 'i' } })) };
    } else {
      filter = { username: { $regex: keyword, $options: 'i' } };
    }

    const users = await this.userModel
      .find(filter)
      .limit(limit)
      .select('username handleName')
      .exec();

    return users.map(u => ({ id: u.id.toString(), username: u.username, handleName: u.handleName || 'No matched users found.' }));
  }
}

import { Controller, Request, Put, Post, Body, Get, Param, UseGuards, UnauthorizedException, NotFoundException, Delete } from '@nestjs/common';
import { UserService } from './user.service';
import { UserDto } from './dto/user.dto';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { User } from './user.schema';
import { JwtAuthGuard } from '@app/common';
import { EditUserDto } from './dto/edit-user.dto';
import { UserDocument } from './user.schema';
import * as bcrypt from 'bcrypt';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // @Post('create-account')
  // async createUser(@Body() userDto: UserDto): Promise<User> {
  //   return this.userService.create(userDto);
  // }

  // @Get()
  // async getAllUsers(): Promise<User[]> {
  //   return this.userService.findAll();
  // }

  // @Get(':username')
  // async getByUsername(
  //   @Param('username') username: string,
  // ): Promise<User | null> {
  //   return this.userService.findOneByUsername(username);
  // }

  @UseGuards(JwtAuthGuard)
  @Put('edit')
  async editUser(
    @Request() req,
    @Body() dto: EditUserDto,
  ) {
    const user = req.user as UserDocument;
    if (!user || !user._id) {
      throw new UnauthorizedException('Invalid session');
    }
    const userId = user._id.toString();

    // check for unique handleName if it's being changed
    if (dto.handleName) {
      const existing = await this.userService.findOneByHandle(dto.handleName);
      if (existing && existing.id !== userId) {
        throw new BadRequestException('Handle name already in use');
      }
    }

    const updated = await this.userService.updateProfile(userId, dto);

    // strip out any sensitive fields before returning
    const { password, refreshToken, ...rest } =
      updated.toObject();
    return rest;
  }

  // edit password
  @UseGuards(JwtAuthGuard)
  @Put('password')
  async changePassword(
    @Request() req,
    @Body() dto: EditUserDto,
  ) {
    const user = req.user as any;
    if (!dto.currentPassword || !dto.newPassword || !dto.confirmPassword) {
      throw new BadRequestException('You must provide currentPassword, newPassword, and confirmPassword');
    }

    // verify current
    const match = await bcrypt.compare(dto.currentPassword, user.password);
    if (!match) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // check confirmPassword
    if (dto.newPassword !== dto.confirmPassword) {
      throw new UnauthorizedException('Confirmation password must be the same as new password');
    }

    // hash & update
    const saltRounds = 10;
    const newHash = await bcrypt.hash(dto.newPassword, saltRounds);
    await this.userService.updatePassword(user._id.toString(), newHash);

    return { message: 'Password changed successfully' };
  }

  // soft-delete current user's account
  @UseGuards(JwtAuthGuard)
  @Delete('/delete')
  async deleteOwnAccount(@Request() req) {
    const user = req.user as any;
    const now = new Date();
    await this.userService.findByIdAndUpdate(user._id.toString(), {
      deletedAt: now,
    });

    //FE TODO: immediately logout client-side
    return { message: 'Account deactivated', deletedAt: now };
  }

  // reactivate deleted account
  @Post('reactivate')
  async reactivateAccount(@Body('id') id: string) {
    const user = await this.userService.findById(id);
    if (!user) throw new NotFoundException('User not found');

    if (!user.deletedAt) {
      throw new BadRequestException('Account is already active');
    }

    const now = new Date();
    const ms = now.getTime() - user.deletedAt.getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    if (days >= 30) {
      // permanently remove
      await this.userService.permanentDelete(id);
      throw new BadRequestException('Account permanently deleted, cannot reactivate');
    }

    // otherwise undo the deletion
    const reactivated = await this.userService.reactivate(id);
    return { message: 'Account reactivated' };
  }

  /**
   * get another user's public profile.
   * Body: { id: string }
   */
  @UseGuards(JwtAuthGuard)
  @Post('public')
  async getPublicProfile(@Body('id') id: string) {
    if (!id) throw new BadRequestException('User id is required');
    return this.userService.getPublicProfile(id);
  }

  /**
   * search users by username or handleName.
   * Body: { mode: 'username' | 'handle', keyword: string }
   */
  @UseGuards(JwtAuthGuard)
  @Post('search')
  async searchUsers(
    @Body('mode') mode: 'username' | 'handle',
    @Body('keyword') keyword: string,
  ) {
    if (!mode || !['username', 'handle'].includes(mode)) {
      throw new BadRequestException("Mode must be 'username' or 'handle'");
    }
    if (!keyword) {
      throw new BadRequestException('Keyword is required');
    }
    return this.userService.searchUsers(mode, keyword, 50);
  }
}

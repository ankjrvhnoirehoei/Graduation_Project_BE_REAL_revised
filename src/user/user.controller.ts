import { Controller, Request, Put, Post, Body, Get, Param, UseGuards, UnauthorizedException } from '@nestjs/common';
import { UserService } from './user.service';
import { UserDto } from './dto/user.dto';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { User } from './user.schema';
import { JwtAuthGuard } from '@app/common';
import { EditUserDto } from './dto/edit-user.dto';
import { UserDocument } from './user.schema';

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
}

import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { UserDto } from './dto/user.sto';
import { User } from './user.schema';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create-account')
  async createUser(@Body() userDto: UserDto): Promise<User> {
    return this.userService.create(userDto);
  }

  @Get()
  async getAllUsers(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Get(':username')
  async getByUsername(
    @Param('username') username: string,
  ): Promise<User | null> {
    return this.userService.findOneByUsername(username);
  }
}

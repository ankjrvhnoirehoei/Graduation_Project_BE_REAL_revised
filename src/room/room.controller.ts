import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';

import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { Room } from './room.schema';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('rooms')
@UseGuards(JwtRefreshAuthGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post('create')
  async createChat(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateRoomDto,
  ): Promise<Room> {
    return this.roomService.createRoom(userId, dto.userIds);
  }

  @Get('all')
  async getMyRooms(
    @CurrentUser('sub') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const p = parseInt(page, 10);
    const l = parseInt(limit, 10);
    return this.roomService.getUserRooms(userId, p, l);
  }  
}

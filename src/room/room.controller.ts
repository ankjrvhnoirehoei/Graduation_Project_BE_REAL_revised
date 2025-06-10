import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Get,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { AddUserToRoomDto, CreateRoomDto } from './dto/room.dto';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { RoomAccessGuard } from 'src/auth/Middleware/room-access.guard';

@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @UseGuards(JwtRefreshAuthGuard)
  @Post()
  create(@Body() dto: CreateRoomDto) {
    return this.roomService.createRoom(dto);
  }

  @UseGuards(JwtRefreshAuthGuard)
  @Post(':roomId/add-user')
  addUserToRoom(@Param('roomId') roomId: string, @Body() dto: AddUserToRoomDto) {
    return this.roomService.addUserToRoom(roomId, dto.user_id);
  }

  @UseGuards(JwtRefreshAuthGuard)
  @Post(':roomId/remove-user')
  removeUserFromRoom(
    @Param('roomId') roomId: string,
    @Body() dto: AddUserToRoomDto,
    @Req() req
  ) {
    return this.roomService.removeUserFromRoom(roomId, dto.user_id, req.user.userId);
  }

  @UseGuards(JwtRefreshAuthGuard, RoomAccessGuard)
  @Get(':roomId')
  getRoom(@Param('roomId') roomId: string) {
    return this.roomService.getRoomWithUsers(roomId);
  }
}

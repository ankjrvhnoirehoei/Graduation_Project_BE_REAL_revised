import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  Get,
  UseGuards,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AddUserToRoomDto, CreateRoomDto } from './dto/room.dto';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  create(@Body() dto: CreateRoomDto, @CurrentUser('sub') userId: string) {
    return this.roomService.createRoom(dto, userId);
  }

  @Post(':roomId/users')
  addUser(@Param('roomId') roomId: string, @Body() dto: AddUserToRoomDto) {
    return this.roomService.addUserToRoom(roomId, dto.user_id);
  }

  @Delete(':roomId/users/:userIdToRemove')
  removeUser(
    @Param('roomId') roomId: string,
    @Param('userIdToRemove') userIdToRemove: string,
    @CurrentUser('sub') currentUserId: string,
  ) {
    return this.roomService.removeUserFromRoom(
      roomId,
      userIdToRemove,
      currentUserId,
    );
  }

  @Get(':roomId/users/me')
  checkUserInRoom(
    @Param('roomId') roomId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.roomService.isUserInRoom(roomId, userId);
  }

  @Get('my')
  getMyRooms(@CurrentUser('sub') userId: string) {
    return this.roomService.getRoomsOfUser(userId);
  }
}

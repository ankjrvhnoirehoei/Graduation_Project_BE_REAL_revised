import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  Get,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AddUserToRoomDto, CreateRoomDto } from './dto/room.dto';
import { UpdateThemeRoomDto } from './dto/update-theme-room.dto';
import { UpdateRoomNameDto } from './dto/update-room-name.dto';

@Controller('rooms')
@UseGuards(JwtRefreshAuthGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) { }

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

  @Get('waiting/my')
  getMyWaitingRooms(@CurrentUser('sub') userId: string) {
    return this.roomService.getWaitingRoomsOfUser(userId);
  }

  @Post(':id/theme')
  async updateRoomTheme(
    @Param('id') roomId: string,
    @Body() updateThemeRoomDto: UpdateThemeRoomDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.roomService.updateTheme(roomId, userId, updateThemeRoomDto);
  }

  @Post(':roomId/name')
  async updateRoomName(
    @Param('roomId') roomId: string,
    @Body() updateRoomNameDto: UpdateRoomNameDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.roomService.updateRoomName(roomId, userId, updateRoomNameDto);
  }

  @Patch(':roomId')
  async updateRoomType(@Param('roomId') roomId: string) {
    return await this.roomService.updateRoomType(roomId);
  }
}

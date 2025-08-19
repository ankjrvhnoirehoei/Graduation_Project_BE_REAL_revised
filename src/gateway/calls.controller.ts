import {
  Body,
  Controller,
  HttpCode,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { RoomService } from 'src/room/room.service';
import { UserService } from 'src/user/user.service';
import { NotificationService } from 'src/notification/notification.service';
import { MessageService } from 'src/message/message.service';
import { AcceptCallDto } from './dto/accept-call.dto';
import { EndCallDto } from './dto/end-call.dto';
import { DeclineCallDto } from './dto/decline-call.dto';

@Controller('calls')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CallsController {
  constructor(
    private readonly gateway: ChatGateway,
    private readonly roomService: RoomService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    private readonly messageService: MessageService,
  ) {}

  @Post('accept')
  @HttpCode(200)
  async acceptCall(@Body() dto: AcceptCallDto) {
    const { roomId, userId, callType } = dto;
    const [user, room] = await Promise.all([
      this.userService.findById(userId),
      this.roomService.findById(roomId),
    ]);
    if (!user || !room)
      return { ok: false, message: 'Room hoặc User không tồn tại' };

    this.gateway.server
      .to(String(roomId))
      .emit('callAccepted', { roomId, userId, callType });

    try {
      const memberIds = await this.roomService.getUserIdsInRoom(roomId);
      const targets = memberIds.filter((id) => id !== userId);
      if (targets.length) {
        await this.notificationService.sendPushNotification(
          targets,
          userId,
          'Cuộc gọi được chấp nhận',
          `${user.username || 'Người dùng'} đã chấp nhận cuộc gọi`,
          {
            type: 'call_accepted',
            roomId: String(roomId),
            userId: String(userId),
            userName: String(user.username || ''),
            callType: String(callType),
          },
          false,
        );
      }
    } catch (e) {
      console.warn('[calls/accept] push error:', e?.message || e);
    }

    return { ok: true };
  }

  // ⬇️⬇️⬇️ MỚI: Callee từ chối — chỉ emit/push, KHÔNG ghi message
  @Post('decline')
  @HttpCode(200)
  async declineCall(@Body() dto: DeclineCallDto) {
    const { roomId, userId, callUuid } = dto;
    const [user, room] = await Promise.all([
      this.userService.findById(userId),
      this.roomService.findById(roomId),
    ]);
    if (!user || !room)
      return { ok: false, message: 'Room hoặc User không tồn tại' };

    // Thông báo realtime cho room
    this.gateway.server
      .to(String(roomId))
      .emit('callDeclined', { roomId, userId, callUuid });

    // Push backup tới bên còn lại
    try {
      const memberIds = await this.roomService.getUserIdsInRoom(roomId);
      const targets = memberIds.filter((id) => id !== userId);
      if (targets.length) {
        await this.notificationService.sendPushNotification(
          targets,
          userId,
          'Cuộc gọi bị từ chối',
          `${user.username || 'Người dùng'} đã từ chối cuộc gọi`,
          {
            type: 'call_declined',
            roomId: String(roomId),
            userId: String(userId),
            userName: String(user.username || ''),
            callUuid: String(callUuid || ''),
          },
          false,
        );
      }
    } catch (e) {
      console.warn('[calls/decline] push error:', e?.message || e);
    }

    return { ok: true };
  }
  // ⬆️⬆️⬆️ END decline

  @Post('end')
  @HttpCode(200)
  async endCall(@Body() dto: EndCallDto) {
    const { roomId, userId, missed, duration = 0, callType } = dto;
    const [user, room] = await Promise.all([
      this.userService.findById(userId),
      this.roomService.findById(roomId),
    ]);
    if (!user || !room)
      return { ok: false, message: 'Room hoặc User không tồn tại' };

    const messageContent = missed ? 'Cuộc gọi nhỡ' : 'Cuộc gọi đã kết thúc';
    try {
      const message = await this.messageService.create({
        roomId,
        senderId: userId,
        content: messageContent,
        media: { type: 'call', url: '', duration: missed ? 0 : duration },
      });
      const populatedMessage = await message.populate({
        path: 'senderId',
        select: 'handleName profilePic',
      });

      this.gateway.server.to(String(roomId)).emit('receiveMessage', {
        _id: populatedMessage._id,
        roomId: populatedMessage.roomId,
        content: populatedMessage.content,
        media: populatedMessage.media,
        createdAt: populatedMessage.createdAt,
        sender: {
          userId,
          handleName: populatedMessage.senderId.handleName,
          profilePic: populatedMessage.senderId.profilePic,
        },
      });

      this.gateway.server
        .to(String(roomId))
        .emit('callEnded', { roomId, endedBy: userId, missed, duration });

      try {
        const memberIds = await this.roomService.getUserIdsInRoom(roomId);
        const targets = memberIds.filter((id) => id !== userId);
        if (targets.length) {
          await this.notificationService.sendPushNotification(
            targets,
            userId,
            missed ? 'Cuộc gọi nhỡ' : 'Cuộc gọi đã kết thúc',
            missed
              ? `${user.username || 'Người dùng'} đã bỏ lỡ cuộc gọi`
              : `${user.username || 'Người dùng'} đã kết thúc cuộc gọi`,
            {
              type: 'call_ended',
              roomId: String(roomId),
              userId: String(userId),
              missed: String(missed),
              duration: String(duration || 0),
              callType: String(callType),
            },
            false,
          );
        }
      } catch (e) {
        console.warn('[calls/end] push error:', e?.message || e);
      }

      return { ok: true };
    } catch (err) {
      console.error('❗ [calls/end] save message error:', err);
      return { ok: false, message: 'Failed to save call message' };
    }
  }
}

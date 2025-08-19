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

  /**
   * Callee/bên nhận bấm "Nghe" (fallback khi socket bị suspend)
   */
  @Post('accept')
  @HttpCode(200)
  async acceptCall(@Body() dto: AcceptCallDto) {
    const { roomId, userId, callType } = dto;

    // (Optional) verify user & room tồn tại
    const [user, room] = await Promise.all([
      this.userService.findById(userId),
      this.roomService.findById(roomId),
    ]);
    if (!user || !room) {
      return { ok: false, message: 'Room hoặc User không tồn tại' };
    }

    // Emit cho tất cả client trong room (caller sẽ nhận được)
    this.gateway.server
      .to(String(roomId))
      .emit('callAccepted', { roomId, userId, callType });

    // Push backup cho người còn lại (phòng 1-1: những người != userId)
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
      // log nhẹ, không fail API
      console.warn('[calls/accept] push error:', e?.message || e);
    }

    return { ok: true };
  }

  /**
   * Kết thúc cuộc gọi (local end hoặc missed) – fallback REST
   */
  @Post('end')
  @HttpCode(200)
  async endCall(@Body() dto: EndCallDto) {
    const { roomId, userId, missed, duration = 0, callType } = dto;

    // (Optional) verify user & room
    const [user, room] = await Promise.all([
      this.userService.findById(userId),
      this.roomService.findById(roomId),
    ]);
    if (!user || !room) {
      return { ok: false, message: 'Room hoặc User không tồn tại' };
    }

    // Lưu message system như bên socket handler
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

      // Broadcast message + callEnded
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

      // Push backup
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

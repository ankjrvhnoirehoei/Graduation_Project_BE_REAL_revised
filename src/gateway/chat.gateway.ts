import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ValidationPipe } from '@nestjs/common';
import { MessageService } from 'src/message/message.service';
import { UserService } from 'src/user/user.service';
import { CreateMessageDto } from 'src/message/dto/message.dto';
import { NotificationService } from 'src/notification/notification.service';
import { RoomService } from 'src/room/room.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private onlineUsers = new Map<string, string>();

  constructor(
    private readonly messageService: MessageService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    private readonly roomService: RoomService,
  ) {}

  afterInit() {
    console.log('✅ WebSocket server initialized');
  }

  handleConnection(client: Socket) {
    console.log(`🔌 Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.onlineUsers.delete(userId);
      console.log(`❌ User ${userId} disconnected`);
    }
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() payload: { roomId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, userId } = payload;
    client.data.userId = userId;
    this.onlineUsers.set(userId, client.id);
    client.join(roomId.toString());
    console.log(`📥 User ${userId} (${client.id}) joined room: ${roomId}`);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(roomId.toString());
    console.log(`📤 Client ${client.id} left room: ${roomId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody(new ValidationPipe({ transform: true }))
    payload: CreateMessageDto & { senderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, senderId, content, media } = payload;

    if (!senderId || !roomId) {
      client.emit('errorMessage', 'Missing senderId or roomId');
      return;
    }

    try {
      const message = await this.messageService.create({
        ...payload,
        senderId,
      });

      const populatedMessage = await message.populate({
        path: 'senderId',
        select: 'handleName profilePic',
      });

      this.server.to(roomId).emit('receiveMessage', {
        _id: populatedMessage._id,
        roomId: populatedMessage.roomId,
        content: populatedMessage.content,
        media: populatedMessage.media,
        createdAt: populatedMessage.createdAt,
        sender: {
          userId: senderId,
          handleName: populatedMessage.senderId.handleName,
          profilePic: populatedMessage.senderId.profilePic,
        },
        reactions: populatedMessage.reactions || [],
      });

      const room = await this.roomService.findById(roomId);
      const isWaiting = room?.type === 'waiting';
      const recipientIds = await this.roomService.getUserIdsInRoom(roomId);
      const sender = await this.userService.findById(senderId);

      for (const recipientId of recipientIds) {
        if (recipientId === senderId) continue;

        const socketId = this.onlineUsers.get(recipientId);
        const isOnline = !!socketId;

        const recipientSocket = socketId
          ? this.server.sockets.sockets.get(socketId)
          : null;
        const inRoom = recipientSocket?.rooms.has(roomId.toString()) ?? false;

        if (!isOnline || !inRoom) {
          const recipient = await this.userService.findById(recipientId);
          if (recipient?.fcmToken) {
            await this.notificationService.sendPushNotification(
              [recipientId],
              senderId,
              'Tin nhắn mới',
              `Bạn có tin nhắn mới từ ${sender?.username || 'người lạ'}`,
              {
                type: 'message',
                roomId,
                isWaiting,
              },
            );
          }
        }
      }
    } catch (err) {
      console.error('❗ Error sending message:', err);
      client.emit('errorMessage', 'Failed to send message');
    }
  }

  @SubscribeMessage('addReaction')
  async handleAddReaction(
    @MessageBody()
    payload: { messageId: string; userId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { messageId, userId, content } = payload;

    if (!messageId || !userId || !content) {
      client.emit('errorMessage', 'Missing required fields for reaction');
      return;
    }

    try {
      const message = await this.messageService.findById(messageId);
      if (!message) throw new Error('Message not found');

      const alreadyReacted = message.reactions?.some(
        (r) => r.userId.toString() === userId && r.content === content,
      );

      let updatedMessage;

      if (alreadyReacted) {
        // remove nếu giống reaction cũ
        updatedMessage = await this.messageService.removeReactionIfExists(
          messageId,
          userId,
          content,
        );
      } else {
        // add hoặc update
        updatedMessage = await this.messageService.addOrUpdateReaction(
          messageId,
          userId,
          content,
        );
      }

      this.server.to(updatedMessage.roomId.toString()).emit('reactionUpdated', {
        messageId,
        reactions: updatedMessage.reactions,
      });
    } catch (err) {
      console.error('❗ Error adding/removing reaction:', err);
      client.emit('errorMessage', 'Failed to update reaction');
    }
  }

  @SubscribeMessage('incomingCall')
  async handleIncomingCall(
    @MessageBody()
    payload: {
      callerId?: string;
      callerName: string;
      type: 'video' | 'voice';
      roomId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const { callerName, type, roomId } = payload;

    // Lấy callerId từ payload hoặc socket data
    let callerId = payload.callerId || client.data?.userId;
    if (!callerId) {
      callerId =
        client.handshake?.auth?.userId || client.handshake?.query?.userId;
    }

    if (!callerId) {
      console.error('❗ No callerId found for incoming call');
      client.emit('errorMessage', 'Unable to identify caller');
      return;
    }

    console.log(
      `📞 Incoming call from ${callerId} (${callerName}) to room ${roomId}`,
    );

    // Cho caller join vào call-room
    client.join(`call-${roomId}`);
    console.log(`📞 Caller ${callerId} joined call room: call-${roomId}`);

    // Emit cho tất cả client khác trong room chat
    client.to(roomId).emit('incomingCall', {
      callerId,
      callerName,
      type,
      roomId,
    });

    try {
      const recipientIds = await this.roomService.getUserIdsInRoom(roomId);
      const targets = recipientIds.filter((id) => id !== callerId);
      if (!targets.length) {
        console.log('📞 No targets found for call notification');
        return;
      }

      console.log(`📞 Sending call notification to: ${targets.join(', ')}`);

      // Tạo callUuid để FE sử dụng hiển thị
      const callUuid = `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const dataPayload = {
        type: 'incoming_call',
        callId: String(roomId),
        callUuid: String(callUuid),
        userId: String(callerId),
        userName: String(callerName || ''),
        callType: String(type || 'video'),
        roomId: String(roomId),
      };

      // Gửi push notification cho các user còn lại
      await this.notificationService.sendPushNotification(
        targets,
        callerId,
        `${callerName} gọi tới`,
        `${callerName} đang gọi bạn`,
        dataPayload,
        false,
      );

      console.log(
        `✔ Sent incoming_call push for callUuid=${callUuid} to`,
        targets,
      );
    } catch (err) {
      console.error('❗ Error sending incoming-call push:', err);
    }
  }

  @SubscribeMessage('callEnded')
  async handleCallEnded(
    @MessageBody()
    payload: {
      roomId: string;
      senderId: string;
      missed: boolean;
      duration?: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, senderId, missed, duration } = payload;
    const messageContent = missed ? 'Cuộc gọi nhỡ' : 'Cuộc gọi đã kết thúc';

    try {
      const message = await this.messageService.create({
        roomId,
        senderId,
        content: messageContent,
        media: {
          type: 'call',
          url: '',
          duration: missed ? 0 : duration || 0,
        },
      });

      const populatedMessage = await message.populate({
        path: 'senderId',
        select: 'handleName profilePic',
      });

      this.server.to(roomId).emit('receiveMessage', {
        _id: populatedMessage._id,
        roomId: populatedMessage.roomId,
        content: populatedMessage.content,
        media: populatedMessage.media,
        createdAt: populatedMessage.createdAt,
        sender: {
          userId: senderId,
          handleName: populatedMessage.senderId.handleName,
          profilePic: populatedMessage.senderId.profilePic,
        },
      });
    } catch (err) {
      console.error('❗ Error saving call message:', err);
      client.emit('errorMessage', 'Failed to save call message');
    }
  }

  @SubscribeMessage('callCancelled')
  handleCallCancelled(
    @MessageBody() payload: { roomId: string; senderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, senderId } = payload;
    console.log(`📞 Call cancelled by ${senderId} in room ${roomId}`);
    client.to(roomId).emit('callCancelled', { senderId });
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @MessageBody()
    payload: { messageId: string; userId: string; roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { messageId, userId, roomId } = payload;

    try {
      const result = await this.messageService.deleteMessageById(
        messageId,
        userId,
      );

      if (result.deleted) {
        this.server.to(roomId).emit('messageDeleted', {
          messageId,
        });
      } else {
        client.emit('errorMessage', 'Không thể xoá tin nhắn');
      }
    } catch (err) {
      console.error('❗ Error deleting message:', err);
      client.emit('errorMessage', 'Lỗi xoá tin nhắn');
    }
  }

  @SubscribeMessage('room:update-theme')
  handleUpdateRoomTheme(
    @MessageBody() payload: { roomId: string; theme: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, theme } = payload;

    if (!roomId || !theme) {
      client.emit('errorMessage', 'Missing roomId or theme');
      return;
    }

    client.to(roomId).emit('room:update-theme', {
      roomId,
      theme,
    });

    console.log(`🎨 Theme updated in room ${roomId}: ${theme}`);
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() payload: { roomId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, userId } = payload;

    if (!roomId || !userId) {
      client.emit('errorMessage', 'Missing roomId or userId');
      return;
    }

    try {
      const user = await this.userService.findById(userId);
      if (!user) return;

      this.server.to(roomId).emit('userTyping', {
        roomId,
        userId,
        username: user.username,
        profilePic: user.profilePic,
      });
    } catch (err) {
      console.error('❗ Error handling typing event:', err);
    }
  }

  @SubscribeMessage('stopTyping')
  async handleStopTyping(
    @MessageBody() payload: { roomId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, userId } = payload;

    if (!roomId || !userId) {
      client.emit('errorMessage', 'Missing roomId or userId');
      return;
    }

    try {
      this.server.to(roomId).emit('userStoppedTyping', {
        roomId,
        userId,
      });
    } catch (err) {
      console.error('❗ Error handling stopTyping event:', err);
    }
  }
}

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
    const userId =
      (client.handshake?.auth?.userId as string) ||
      (client.handshake?.query?.userId as string);

    console.log(`🔌 Client connected: ${client.id}, userId=${userId ?? 'N/A'}`);

    if (userId) {
      client.data.userId = String(userId);
      this.onlineUsers.set(String(userId), client.id);
      // Private room theo user để emit trực tiếp
      client.join(`user:${String(userId)}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.onlineUsers.delete(String(userId));
      console.log(`❌ User ${userId} disconnected`);
    }
    // Rời tất cả rooms (set có client.id chính nó)
    for (const room of client.rooms) {
      if (room !== client.id) client.leave(room);
    }
  }

  private getUserIdFromClient(client: Socket): string | null {
    return (
      client.data?.userId ||
      (client.handshake?.auth?.userId as string) ||
      (client.handshake?.query?.userId as string) ||
      null
    );
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() payload: { roomId?: string; userId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = String(payload?.roomId ?? '').trim();
    let userId = String(payload?.userId ?? '').trim();

    if (!userId) {
      userId = this.getUserIdFromClient(client) ?? '';
    }
    if (!roomId || !userId) {
      client.emit('errorMessage', 'Missing roomId or userId in joinRoom');
      return;
    }

    client.data.userId = userId;
    this.onlineUsers.set(userId, client.id);
    client.join(roomId);
    console.log(`📥 User ${userId} (${client.id}) joined room: ${roomId}`);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const rid = String(roomId);
    client.leave(rid);
    console.log(`📤 Client ${client.id} left room: ${rid}`);
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

    let callerId =
      payload.callerId ||
      client.data?.userId ||
      (client.handshake?.auth?.userId as string) ||
      (client.handshake?.query?.userId as string);

    if (!callerId) {
      console.error('❗ No callerId found for incoming call');
      client.emit('errorMessage', 'Unable to identify caller');
      return;
    }

    console.log(
      `📞 Incoming call from ${callerId} (${callerName}) to room ${roomId}`,
    );

    // Caller join call-room (tùy bạn giữ hay bỏ; không ảnh hưởng flow FE)
    client.join(`call-${roomId}`);

    // Tạo callUuid dùng chung cho socket + push
    const callUuid = `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 1) Emit cho ai ĐANG ở trong room chat
    client.to(roomId).emit('incomingCall', {
      callerId,
      callerName,
      type,
      roomId,
      callUuid,
    });

    try {
      const recipientIds = await this.roomService.getUserIdsInRoom(roomId);
      const targets = recipientIds.filter((id) => id !== callerId);

      // 2) Emit TRỰC TIẾP tới user online nhưng KHÔNG mở room
      for (const uid of targets) {
        const sid = this.onlineUsers.get(uid);
        if (sid) {
          this.server.to(sid).emit('incomingCall', {
            callerId,
            callerName,
            type,
            roomId,
            callUuid,
          });
        }
      }

      // 3) Push FCM (để backup khi user offline)
      const dataPayload = {
        type: 'incoming_call',
        callId: String(roomId),
        callUuid: String(callUuid),
        userId: String(callerId),
        userName: String(callerName || ''),
        callType: String(type || 'video'),
        roomId: String(roomId),
      };
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
    const roomId = String(payload.roomId || '');
    const senderId = String(
      payload.senderId || this.getUserIdFromClient(client) || '',
    );
    const { missed, duration } = payload;

    if (!roomId || !senderId) {
      client.emit('errorMessage', 'Missing roomId or senderId');
      return;
    }

    const messageContent = missed ? 'Cuộc gọi nhỡ' : 'Cuộc gọi đã kết thúc';
    try {
      const message = await this.messageService.create({
        roomId,
        senderId,
        content: messageContent,
        media: { type: 'call', url: '', duration: missed ? 0 : duration || 0 },
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

      this.server
        .to(roomId)
        .emit('callEnded', { roomId, endedBy: senderId, missed, duration });
    } catch (err) {
      console.error('❗ Error saving call message:', err);
      client.emit('errorMessage', 'Failed to save call message');
    }
  }

  @SubscribeMessage('acceptCall')
  handleAcceptCall(
    @MessageBody()
    payload: { roomId: string; userId?: string; callType: 'video' | 'voice' },
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = String(payload?.roomId || '').trim();
    let userId = String(payload?.userId || '').trim();

    if (!userId) {
      userId = this.getUserIdFromClient(client) || '';
    }
    if (!roomId || !userId) {
      client.emit('errorMessage', 'Missing roomId or userId');
      return;
    }

    client.data.userId = userId;
    this.onlineUsers.set(userId, client.id);
    client.join(roomId);
    console.log(`✅ ${userId} accepted call and joined room: ${roomId}`);

    this.server
      .to(roomId)
      .emit('callAccepted', { roomId, userId, callType: payload.callType });
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

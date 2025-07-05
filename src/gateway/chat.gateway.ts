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
    client.join(roomId);
    console.log(`📥 User ${userId} (${client.id}) joined room: ${roomId}`);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(roomId);
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
      });

      const recipientIds = await this.roomService.getUserIdsInRoom(roomId);
      const sender = await this.userService.findById(senderId);

      for (const recipientId of recipientIds) {
        if (recipientId === senderId) continue;

        const socketId = this.onlineUsers.get(recipientId);
        const isOnline = !!socketId;
        const inRoom =
          isOnline &&
          this.server.sockets.adapter.rooms.get(roomId)?.has(socketId);

        if (!isOnline || !inRoom) {
          const recipient = await this.userService.findById(recipientId);
          if (recipient?.fcmToken) {
            await this.notificationService.sendPushNotification(
              [recipientId],
              senderId,
              'Tin nhắn mới',
              `Bạn có tin nhắn mới từ ${sender?.username || 'người lạ'}`,
              {
                type: 'chat',
                roomId,
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

  @SubscribeMessage('incomingCall')
  handleIncomingCall(
    @MessageBody()
    payload: { callerName: string; type: 'video' | 'voice'; roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { callerName, type, roomId } = payload;
    client.to(roomId).emit('incomingCall', { callerName, type });
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
}

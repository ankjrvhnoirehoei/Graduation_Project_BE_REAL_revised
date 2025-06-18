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

  constructor(
    private readonly messageService: MessageService,
    private readonly userService: UserService,
  ) {}

  afterInit(server: Server) {
    console.log('✅ WebSocket server initialized');
  }

  handleConnection(client: Socket) {
    console.log(`🔌 Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(roomId);
    console.log(`📥 Client ${client.id} joined room: ${roomId}`);
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
      callType: 'voice' | 'video';
      missed: boolean;
      duration?: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, senderId, callType, missed, duration } = payload;

    const messageContent = missed
      ? `Bạn đã bỏ lỡ cuộc gọi ${callType === 'voice' ? 'thoại' : 'video'}.`
      : `Cuộc gọi ${callType === 'voice' ? 'thoại' : 'video'} kéo dài ${duration} giây.`;

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
}

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
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
import { socketJwtMiddleware } from 'src/auth/Middleware/jwt.socket-middleware';
import { CreateMessageDto } from 'src/message/dto/message.dto';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly messageService: MessageService,
    private readonly userService: UserService,
  ) {}

  afterInit(server: Server) {
    const chatNamespace = server.of('/chat');
    chatNamespace.use(socketJwtMiddleware);
    console.log('WebSocket server initialized at /chat');
  }

  handleConnection(client: Socket) {
    const user = client.data.user;
    if (user) {
      console.log(`Client connected: ${user._id}`);
    } else {
      console.log('Client connected without user');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user;
    console.log(`Client disconnected: ${user?._id || 'unknown user'}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(roomId);
    console.log(`Client joined room: ${roomId}`);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(roomId);
    console.log(`Client left room: ${roomId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody(new ValidationPipe({ transform: true }))
    payload: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    if (!user || !user._id) {
      return client.emit('errorMessage', 'Unauthorized');
    }

    const message = await this.messageService.create({
      ...payload,
      senderId: user._id,
    });

    const populatedMessage = await message.populate({
      path: 'senderId',
      select: 'handleName profilePic',
    });

    this.server.to(payload.roomId).emit('receiveMessage', {
      _id: populatedMessage._id,
      roomId: populatedMessage.roomId,
      content: populatedMessage.content,
      media: populatedMessage.media,
      createdAt: populatedMessage.createdAt,
      sender: {
        userId: user._id,
        handleName: populatedMessage.senderId.handleName,
        profilePic: populatedMessage.senderId.profilePic,
      },
    });
  }
}

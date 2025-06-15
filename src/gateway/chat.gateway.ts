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
import { CreateMessageDto } from 'src/message/dto/message.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket'],
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly messageService: MessageService,
    private readonly userService: UserService,
  ) {}

  afterInit(server: Server) {
    console.log('WebSocket server initialized at /chat');
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(roomId);
    console.log(`Client ${client.id} joined room: ${roomId}`);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(roomId);
    console.log(`Client ${client.id} left room: ${roomId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody(new ValidationPipe({ transform: true }))
    payload: CreateMessageDto & { senderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, senderId } = payload;

    if (!senderId || !roomId) {
      return client.emit('errorMessage', 'Missing senderId or roomId');
    }

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
  }
}

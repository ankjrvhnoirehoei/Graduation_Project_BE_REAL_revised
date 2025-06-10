import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { RoomService } from '../room/room.service';
import { CreateRoomDto } from '../room/dto/room.dto';
import { UserService } from 'src/user/user.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly roomService: RoomService,
    private readonly userService: UserService,
  ) {}

  handleConnection(socket: Socket) {
    console.log('🟢 Client connected:', socket.id);
  }

  handleDisconnect(socket: Socket) {
    console.log('🔴 Client disconnected:', socket.id);
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @MessageBody() data: { room_id: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const roomId = data.room_id;

    if (!roomId) {
      socket.emit('error', { message: 'Missing roomId' });
      return;
    }

    socket.join(roomId);
    socket.emit('joined_room', { room_id: roomId });
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(
    @MessageBody() data: { room_id: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const roomId = data.room_id;

    if (!roomId) {
      socket.emit('error', { message: 'Missing roomId' });
      return;
    }

    socket.leave(roomId);
    socket.emit('left_room', { room_id: roomId });
  }

  @SubscribeMessage('create_room')
  async handleCreateRoom(
    @MessageBody() data: CreateRoomDto,
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = socket.handshake.auth?.userId;

    if (!userId) {
      socket.emit('error', { message: 'Missing userId in handshake auth' });
      return;
    }

    try {
      const room = await this.roomService.createRoom(data, userId);
      socket.emit('room_created', { room_id: room._id, name: room.name });
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', {
        message: 'Failed to create room',
        code: 'CREATE_ROOM_ERROR',
      });
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { room_id: string; message: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { room_id, message } = data;
    const senderId = socket.handshake.auth?.userId;

    if (!room_id || !message || !senderId) {
      socket.emit('error', { message: 'Thiếu room_id, message hoặc userId' });
      return;
    }

    const user = await this.userService.findById(senderId);
    if (!user) {
      socket.emit('error', { message: 'Không tìm thấy user' });
      return;
    }

    const payload = {
      room_id,
      message,
      sender: {
        _id: user._id,
        handleName: user.handleName,
        profilePic: user.profilePic,
      },
      timestamp: new Date().toISOString(),
    };

    socket.to(room_id).emit('new_message', payload);
    socket.emit('new_message', payload);
  }
}

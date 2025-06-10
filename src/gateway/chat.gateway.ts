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
import { CreateRoomDto, AddUserToRoomDto } from '../room/dto/room.dto';
import { Types } from 'mongoose';
import { Room } from 'src/room/room.schema';

@WebSocketGateway({
  cors: {
    origin: ['http://cirla.io.vn'],
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly roomService: RoomService) {}

  handleConnection(socket: Socket) {
    console.log('🟢 Client connected:', socket.id);
  }

  handleDisconnect(socket: Socket) {
    console.log('🔴 Client disconnected:', socket.id);
  }

  /**
   * User joins a room if they already exist in room.user_ids
   */
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: { room_id: string; user_id: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { room_id, user_id } = data;

    if (!room_id || !user_id) {
      socket.emit('error', {
        message: 'Missing room_id or user_id in request',
        code: 'MISSING_PARAMS',
      });
      return;
    }

    try {
      const room = await this.roomService.getRoomWithUsers(room_id);
      if (!room) {
        socket.emit('error', {
          message: 'Room not found',
          code: 'ROOM_NOT_FOUND',
        });
        return;
      }

      const isUserInRoom = room.user_ids.some(
        (id) => id.toString() === user_id,
      );

      if (!isUserInRoom) {
        socket.emit('error', {
          message: 'You are not authorized to join this room',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      socket.join(room_id);
      socket.data.currentRoom = room_id;

      socket.emit('joined_room', {
        room_id,
        users: room.user_ids,
      });
    } catch (err) {
      console.error('Error in join_room:', err);
      socket.emit('error', {
        message: 'Internal server error',
        code: 'JOIN_ROOM_ERROR',
      });
    }
  }

  /**
   * Create a room and auto join creator to the room
   */
  @SubscribeMessage('create_room')
  async handleCreateRoom(
    @MessageBody() data: CreateRoomDto,
    @ConnectedSocket() socket: Socket,
  ) {
    const { create_by } = data;

    if (!create_by) {
      socket.emit('error', {
        message: 'Missing create_by in request',
        code: 'MISSING_CREATOR',
      });
      return;
    }

    try {
      const room = (await this.roomService.createRoom(data)) as Room;

      socket.join((room._id as Types.ObjectId).toString());
      socket.data.currentRoom = (room._id as Types.ObjectId).toString();

      socket.emit('room_created', {
        room_id: room._id,
        name: room.name,
        user_ids: room.user_ids,
      });
    } catch (err) {
      console.error('Error in create_room:', err);
      socket.emit('error', {
        message: 'Failed to create room',
        code: 'CREATE_ROOM_ERROR',
      });
    }
  }

  /**
   * Optional: Add user to room (requires creator permission)
   */
  @SubscribeMessage('add_user_to_room')
  async handleAddUserToRoom(
    @MessageBody()
    data: { room_id: string; user_id: string; requester_id: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { room_id, user_id, requester_id } = data;

    try {
      const room = await this.roomService.getRoomWithUsers(room_id);
      if (!room) {
        socket.emit('error', {
          message: 'Room not found',
          code: 'ROOM_NOT_FOUND',
        });
        return;
      }

      if (room.create_by.toString() !== requester_id) {
        socket.emit('error', {
          message: 'Only room creator can add users',
          code: 'NOT_AUTHORIZED',
        });
        return;
      }

      await this.roomService.addUserToRoom(room_id, user_id);

      socket.emit('user_added_to_room', {
        room_id,
        user_id,
      });
    } catch (err) {
      console.error('Error adding user to room:', err);
      socket.emit('error', {
        message: 'Failed to add user',
        code: 'ADD_USER_ERROR',
      });
    }
  }
}

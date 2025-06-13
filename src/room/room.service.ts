import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room } from './room.schema';
import { CreateRoomDto } from './dto/room.dto';

@Injectable()
export class RoomService {
  constructor(@InjectModel(Room.name) private roomModel: Model<Room>) {}

  async createRoom(
    createRoomDto: CreateRoomDto,
    userId: string,
  ): Promise<Room> {
    const allUserIds = Array.from(
      new Set([
        ...(createRoomDto.user_ids ?? []).map((id) => new Types.ObjectId(id)),
        new Types.ObjectId(userId),
      ]),
    );

    return this.roomModel.create({
      ...createRoomDto,
      created_by: new Types.ObjectId(userId),
      user_ids: allUserIds,
    });
  }

  async addUserToRoom(roomId: string, userIdToAdd: string): Promise<Room> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');

    const userIdToAddObj = new Types.ObjectId(userIdToAdd);
    if (room.user_ids.includes(userIdToAddObj)) return room;

    room.user_ids.push(userIdToAddObj);
    return room.save();
  }

  async removeUserFromRoom(
    roomId: string,
    userIdToRemove: string,
    currentUserId: string,
  ): Promise<Room> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');

    if (room.created_by.toString() !== currentUserId) {
      throw new ForbiddenException('Only the creator can remove users');
    }

    room.user_ids = room.user_ids.filter(
      (id) => id.toString() !== userIdToRemove,
    );
    return room.save();
  }

  async isUserInRoom(roomId: string, userId: string): Promise<boolean> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');
    return room.user_ids.some((id) => id.toString() === userId);
  }

  async getRoomsOfUser(userId: string): Promise<any[]> {
    const rooms = await this.roomModel
      .find({ user_ids: new Types.ObjectId(userId) })
      .populate('user_ids', '_id handleName profilePic')
      .exec();

    return rooms.map((room) => ({
      _id: room._id,
      name: room.name,
      theme: room.theme,
      type: room.type,
      user_ids: room.user_ids,
      created_by: room.created_by,
    }));
  }
}

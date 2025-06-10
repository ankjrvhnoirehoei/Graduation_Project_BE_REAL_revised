import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room } from './room.schema';
import { CreateRoomDto } from './dto/room.dto';

@Injectable()
export class RoomService {
  constructor(@InjectModel(Room.name) private roomModel: Model<Room>) {}

  async createRoom(dto: CreateRoomDto): Promise<Room> {
    const newRoom = new this.roomModel({
      ...dto,
      user_ids: [new Types.ObjectId(dto.create_by)],
    });
    return newRoom.save();
  }

  async addUserToRoom(roomId: string, userId: string): Promise<Room> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');

    await this.roomModel.updateOne(
      { _id: roomId },
      { $addToSet: { user_ids: new Types.ObjectId(userId) } }
    );

    const updatedRoom = await this.roomModel.findById(roomId);
    if (!updatedRoom) throw new NotFoundException('Room not found');
    return updatedRoom;
  }

  async removeUserFromRoom(
    roomId: string,
    userId: string,
    requesterId: string
  ): Promise<Room> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');

    if (room.create_by.toString() !== requesterId) {
      throw new ForbiddenException('Only the creator can remove users');
    }

    await this.roomModel.updateOne(
      { _id: roomId },
      { $pull: { user_ids: new Types.ObjectId(userId) } }
    );

    const updatedRoom = await this.roomModel.findById(roomId);
    if (!updatedRoom) throw new NotFoundException('Room not found');
    return updatedRoom;
  }

  async isUserInRoom(roomId: string, userId: string): Promise<boolean> {
    const room = await this.roomModel.findOne({
      _id: roomId,
      user_ids: new Types.ObjectId(userId),
    });
    return !!room;
  }

  async getRoomWithUsers(roomId: string): Promise<Room> {
    const room = await this.roomModel
      .findById(roomId)
      .populate('user_ids', 'username email avatar');
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }
}

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room } from './room.schema';
import { CreateRoomDto } from './dto/room.dto';
import { UpdateThemeRoomDto } from './dto/update-theme-room.dto';
import { UpdateRoomNameDto } from './dto/update-room-name.dto';
import { Message } from '../message/message.schema';
@Injectable()
export class RoomService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<Room>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
  ) {}

  async createRoom(
    createRoomDto: CreateRoomDto,
    userId: string,
  ): Promise<{ room: Room; isExisted: boolean; message: string }> {
    const allUserIds = Array.from(
      new Set([
        ...(createRoomDto.user_ids ?? []).map((id) => new Types.ObjectId(id)),
        new Types.ObjectId(userId),
      ]),
    );

    const existingRoom = await this.roomModel
      .findOne({
        user_ids: { $all: allUserIds, $size: allUserIds.length },
      })
      .populate('user_ids', '_id handleName profilePic');

    if (existingRoom) {
      return {
        room: existingRoom,
        isExisted: true,
        message: 'Room already exists',
      };
    }

    const createdRoom = await this.roomModel.create({
      ...createRoomDto,
      created_by: new Types.ObjectId(userId),
      user_ids: allUserIds,
    });

    const populatedRoom = await this.roomModel
      .findById(createdRoom._id)
      .populate('user_ids', '_id handleName profilePic');

    if (!populatedRoom) {
      throw new NotFoundException('Created room not found');
    }

    return {
      room: populatedRoom,
      isExisted: false,
      message: 'Room created successfully',
    };
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
      .lean();

    const stringRoomIds = rooms.map((room) => room._id.toString());

    const messages = await this.messageModel.aggregate([
      {
        $match: {
          roomId: { $in: stringRoomIds },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$roomId',
          messageId: { $first: '$_id' },
          content: { $first: '$content' },
          senderId: { $first: '$senderId' },
          media: { $first: '$media' },
          createdAt: { $first: '$createdAt' },
        },
      },
    ]);

    const latestMessageMap = new Map<string, any>();
    messages.forEach((msg) => {
      latestMessageMap.set(msg._id, msg);
    });

    const roomsWithMessages = rooms.map((room) => {
      const latestMessage = latestMessageMap.get(room._id.toString()) ?? null;

      return {
        _id: room._id,
        name: room.name,
        theme: room.theme,
        type: room.type,
        user_ids: room.user_ids,
        created_by: room.created_by,
        latestMessage,
      };
    });

    roomsWithMessages.sort((a, b) => {
      const aTime = a.latestMessage?.createdAt
        ? new Date(a.latestMessage.createdAt).getTime()
        : 0;
      const bTime = b.latestMessage?.createdAt
        ? new Date(b.latestMessage.createdAt).getTime()
        : 0;
      return bTime - aTime;
    });

    return roomsWithMessages;
  }

  async updateTheme(
    roomId: string,
    userId: string,
    updateThemeRoomDto: UpdateThemeRoomDto,
  ): Promise<Room> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');

    if (!room.user_ids.some((id) => id.toString() === userId)) {
      throw new ForbiddenException('You are not a member of this room');
    }

    room.theme = updateThemeRoomDto.theme;
    return room.save();
  }

  async updateRoomName(
    roomId: string,
    userId: string,
    updateRoomNameDto: UpdateRoomNameDto,
  ): Promise<Room> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');

    const isMember = room.user_ids.some((id) => id.toString() === userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this room');
    }

    room.name = updateRoomNameDto.name;
    return room.save();
  }
}

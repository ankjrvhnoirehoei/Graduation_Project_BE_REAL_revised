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
import {
  Relation,
  RelationDocument,
  RelationType,
} from 'src/relation/relation.schema';
@Injectable()
export class RoomService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<Room>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(Relation.name) private relationModel: Model<RelationDocument>,
  ) {}

  async findById(roomId: string): Promise<Room | null> {
    return this.roomModel.findById(roomId).exec();
  }

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
      .populate('user_ids', '_id handleName username profilePic');

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
    // 1) Lấy danh sách room
    const rooms = await this.roomModel
      .find({
        $or: [
          {
            $and: [
              { user_ids: new Types.ObjectId(userId) },
              { type: 'accept' },
            ],
          },
          {
            $and: [
              { created_by: new Types.ObjectId(userId) },
              { type: 'waiting' },
            ],
          },
        ],
      })
      .populate('user_ids', '_id handleName username profilePic')
      .lean<
        {
          _id: Types.ObjectId;
          name: string;
          theme?: string;
          type: string;
          user_ids: Types.ObjectId[];
          created_by: Types.ObjectId;
          createdAt: Date;
        }[]
      >();

    // 2) Nếu muốn an toàn, có thể filter thêm
    const validRooms = rooms.filter((r) => r && typeof r.type === 'string');

    // 3) Chuẩn bị danh sách roomId dưới dạng string
    const stringRoomIds = validRooms.map((room) => room._id.toString());

    // 4) Lấy tin nhắn mới nhất cho mỗi room
    const messages = await this.messageModel.aggregate([
      { $match: { roomId: { $in: stringRoomIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$roomId',
          messageId: { $first: '$_id' },
          content: { $first: '$content' },
          senderId: { $first: '$senderId' },
          media: { $first: '$media' },
          createdAt: { $first: '$createdAt' },
          isDeleted: { $first: '$isDeleted' },
        },
      },
    ]);

    // 5) Build map _id → latestMessage, có guard media null
    const latestMessageMap = new Map<string, any>();
    for (const msg of messages) {
      if (msg.isDeleted) {
        msg.content = 'Tin nhắn đã bị thu hồi';
        msg.media = null;
      }
      // chỉ check type khi media khác null
      if (msg.media?.type === 'image') {
        msg.content = 'Hình ảnh';
      }
      latestMessageMap.set(msg._id, msg);
    }

    // 6) Ghép room với latestMessage, giữ createdAt để sort
    const roomsWithMessages = validRooms.map((room) => ({
      _id: room._id,
      name: room.name,
      theme: room.theme,
      type: room.type,
      user_ids: room.user_ids,
      created_by: room.created_by,
      createdAt: room.createdAt,
      latestMessage: latestMessageMap.get(room._id.toString()) ?? null,
    }));

    // 7) Sort theo thời gian (tạo room vs tin nhắn mới nhất)
    roomsWithMessages.sort((a, b) => {
      const aRoomTime = a.createdAt.getTime();
      const bRoomTime = b.createdAt.getTime();
      const aMsgTime = a.latestMessage?.createdAt
        ? new Date(a.latestMessage.createdAt).getTime()
        : 0;
      const bMsgTime = b.latestMessage?.createdAt
        ? new Date(b.latestMessage.createdAt).getTime()
        : 0;
      return Math.max(bRoomTime, bMsgTime) - Math.max(aRoomTime, aMsgTime);
    });

    // 8) Trả về cấu trúc ban đầu, bỏ createdAt tạm
    return roomsWithMessages.map(({ createdAt, ...rest }) => rest);
  }

  async getWaitingRoomsOfUser(userId: string): Promise<any[]> {
    const rooms = await this.roomModel
      .find({
        user_ids: new Types.ObjectId(userId),
        type: 'waiting',
        created_by: { $ne: new Types.ObjectId(userId) }, // loại bỏ các room mình tạo
      })
      .populate('user_ids', '_id handleName username profilePic')
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

  async getUserIdsInRoom(roomId: string): Promise<string[]> {
    const room = await this.roomModel
      .findById(roomId)
      .select('user_ids')
      .lean();

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room.user_ids.map((id: Types.ObjectId) => id.toString());
  }

  async updateRoomType(roomId: string) {
    const updated = await this.roomModel
      .updateOne({ _id: roomId }, { type: 'accept' })
      .lean();
    return {
      message: 'success',
      data: updated.upsertedId,
    };
  }

  async getRoomById(id: string) {
    return this.roomModel
      .findById(id)
      .populate({
        path: 'user_ids',
        select: '-password -refreshToken -fcmToken -role',
      })
      .exec();
  }

  async getUsersInRoom(
    roomId: string,
    currentUserId: string,
  ): Promise<{
    /* ... */
  }> {
    // 1) Lấy room + userDocs như cũ…
    const room = await this.roomModel
      .findById(roomId)
      .populate('user_ids', 'username handleName bio gender profilePic')
      .lean()
      .exec();
    if (!room) throw new NotFoundException('Room not found');

    const userDocs = room.user_ids as any[];
    // ép tất cả userIds trong room thành ObjectId
    const roomUserIds = userDocs.map(
      (u) => new Types.ObjectId(u._id.toString()),
    );

    // ép currentUserId về ObjectId
    const me = new Types.ObjectId(currentUserId);

    // 2) Query relation “follow” hai chiều, dùng ObjectId cho cả hai bên
    const relations = await this.relationModel
      .find({
        $or: [
          {
            userOneID: me,
            userTwoID: { $in: roomUserIds },
            relation: {
              $in: [RelationType.FOLLOW_NULL, RelationType.FOLLOW_FOLLOW],
            },
          },
          {
            userTwoID: me,
            userOneID: { $in: roomUserIds },
            relation: {
              $in: [RelationType.NULL_FOLLOW, RelationType.FOLLOW_FOLLOW],
            },
          },
        ],
      })
      .lean();

    // 3) Build set để lookup nhanh
    const followSet = new Set<string>();
    relations.forEach((rel) => {
      const u1 = rel.userOneID.toString();
      const u2 = rel.userTwoID.toString();
      const other = u1 === currentUserId ? u2 : u1;
      followSet.add(other);
    });

    // 4) Build kết quả
    const users = userDocs.map((u) => {
      const id = u._id.toString();
      return {
        user_id: id,
        username: u.username,
        handleName: u.handleName,
        bio: u.bio,
        gender: u.gender,
        profilePic: u.profilePic,
        isCreated: room.created_by.toString() === id,
        isFollow: followSet.has(id),
      };
    });

    return {
      count: users.length,
      users,
    };
  }

  async getAvailableFriends(
    roomId: string,
    currentUserId: string,
  ): Promise<
    Array<{
      user_id: string;
      username: string;
      handleName: string;
      bio?: string;
      gender?: string;
      profilePic?: string;
    }>
  > {
    // 1) Lấy room + user_ids
    const room = await this.roomModel
      .findById(roomId)
      .select('user_ids')
      .lean()
      .exec();
    if (!room) throw new NotFoundException('Room not found');

    const roomUserIds = (room.user_ids as Types.ObjectId[]).map((id) =>
      id.toString(),
    );

    // 2) Query tất cả follow‑follow dùng ObjectId
    const me = new Types.ObjectId(currentUserId);
    const rels = await this.relationModel
      .find({
        relation: RelationType.FOLLOW_FOLLOW,
        $or: [{ userOneID: me }, { userTwoID: me }],
      })
      .populate('userOneID', 'username handleName bio gender profilePic')
      .populate('userTwoID', 'username handleName bio gender profilePic')
      .lean();

    // 3) Map ra friend và lọc trùng + đã trong room
    const available = rels
      .map((rel) => {
        const u1 = rel.userOneID as any;
        const u2 = rel.userTwoID as any;
        const friend = u1._id.toString() === currentUserId ? u2 : u1;
        return {
          user_id: friend._id.toString(),
          username: friend.username,
          handleName: friend.handleName,
          bio: friend.bio,
          gender: friend.gender,
          profilePic: friend.profilePic,
        };
      })
      // lọc bỏ những ai đã trong room
      .filter((f) => !roomUserIds.includes(f.user_id))
      // de‑dup
      .filter(
        (f, idx, arr) => arr.findIndex((x) => x.user_id === f.user_id) === idx,
      );

    return available;
  }

  async addUsersToRoomBatch(
    roomId: string,
    userIdsToAdd: string[],
  ): Promise<Room> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // convert và lọc những user chưa có trong room
    const existingIds = room.user_ids.map((id) => id.toString());
    const toAdd = userIdsToAdd
      .map((id) => new Types.ObjectId(id))
      .filter((oid) => !existingIds.includes(oid.toString()));

    if (toAdd.length) {
      room.user_ids.push(...toAdd);
      await room.save();
    }

    // populate trước khi trả về
    return this.roomModel
      .findById(roomId)
      .populate('user_ids', '_id handleName profilePic')
      .exec();
  }

  async leaveRoom(
    roomId: string,
    userId: string,
  ): Promise<{ deleted: boolean }> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException('Không tìm thấy nhóm.');
    }

    const uid = new Types.ObjectId(userId);
    const isMember = room.user_ids.some((id) => id.equals(uid));
    if (!isMember) {
      throw new ForbiddenException('Bạn không thuộc nhóm này.');
    }

    // 1. Remove user khỏi mảng
    room.user_ids = room.user_ids.filter((id) => !id.equals(uid));

    // 2. Nếu mảng rỗng → xóa nhóm
    if (room.user_ids.length === 0) {
      await this.roomModel.findByIdAndDelete(roomId);
      return { deleted: true };
    }

    // 3. Nếu người leave là creator và vẫn còn members → chọn creator mới
    if (room.created_by.equals(uid)) {
      room.created_by = room.user_ids[0]; // hoặc logic pick khác
    }

    await room.save();
    return { deleted: false };
  }

  async removeMember(
    roomId: string,
    leaderId: string,
    memberId: string,
  ): Promise<void> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException('Không tìm thấy nhóm.');
    }

    const leaderObjId = new Types.ObjectId(leaderId);
    if (!room.created_by.equals(leaderObjId)) {
      throw new ForbiddenException('Chỉ nhóm trưởng mới được xóa thành viên.');
    }

    const targetObjId = new Types.ObjectId(memberId);
    const isMember = room.user_ids.some((id) => id.equals(targetObjId));
    if (!isMember) {
      throw new NotFoundException('Thành viên này không có trong nhóm.');
    }

    // Lọc ra member
    room.user_ids = room.user_ids.filter((id) => !id.equals(targetObjId));
    await room.save();
  }
}

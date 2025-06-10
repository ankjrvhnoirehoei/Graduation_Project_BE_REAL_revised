import { Injectable, ForbiddenException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Room, RoomDocument } from './room.schema';
import { RoomMemberService }     from '../room-member/room-member.service';
import { Relation, RelationDocument, RelationType } from '../relation/relation.schema';
import { UserService } from '../user/user.service';

@Injectable()
export class RoomService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Relation.name) private relModel: Model<RelationDocument>,
    private readonly memberService: RoomMemberService,
    private readonly userService:    UserService,
  ) {}

    async getById(roomId: string): Promise<RoomDocument> {
        let objId: Types.ObjectId;
        try {
        objId = new Types.ObjectId(roomId);
        } catch {
        throw new BadRequestException('Invalid room ID');
        }

        const room = await this.roomModel.findById(objId);
        if (!room) {
        throw new NotFoundException('Room not found');
        }
        return room;
    }

  async createRoom(creatorId: string, userIds: string[]): Promise<Room> {
    const me  = new Types.ObjectId(creatorId);
    const ids = userIds.map((id) => new Types.ObjectId(id));

    // SINGLE CHAT
    if (ids.length === 1) {
      const other = ids[0];

      // block check
      const rel = await this.relModel.findOne({
        $or: [
          { userOneID: me,   userTwoID: other },
          { userOneID: other, userTwoID: me   },
        ]
      }).lean();

      if (rel && rel.relation.includes('BLOCK')) {
        throw new ForbiddenException(`Cannot start chat: one user has blocked the other.`);
      }

      // existing single‐chat?
      const shared = await this.memberService.findByUsersAndFlag([creatorId, userIds[0]], true);
      if (shared) {
        const room = await this.roomModel.findById(shared.room).lean();
        if (!room) {
          throw new ConflictException('Room not found');
        }
        return room;
      }

      // create new
      const [u1, u2] = await Promise.all([
        this.userService.getUserById(creatorId),
        this.userService.getUserById(userIds[0]),
      ]);
      const room = await this.roomModel.create({
        type:      'single',
        name:      `${u1.username} & ${u2.username}`,
        created_by: me,
      });

      // add members
      await Promise.all([
        this.memberService.create(room._id.toHexString(), creatorId, 'normal', true),
        this.memberService.create(room._id.toHexString(), userIds[0],   'normal', true),
      ]);

      return room;
    }

    // GROUP CHAT
    if (ids.length >= 2) {
      // fetch usernames for naming
      const allIds = [creatorId, ...userIds];
      const users  = await this.userService.findManyByIds(allIds);
      const names  = allIds.map(id => users.find(u => u?._id?.toString() === id)?.username ?? 'Unknown');
      const roomName = `${names[0]}, ${names[1]} and more`;

      // create room
      const room = await this.roomModel.create({
        type:       'group',
        name:       roomName,
        created_by: me,
      });

      // add members
      await Promise.all([
        this.memberService.create(room._id.toHexString(), creatorId, 'admin', false),
        ...userIds.map(uid => 
          this.memberService.create(room._id.toHexString(), uid, 'normal', false)
        ),
      ]);

      return room;
    }

    throw new ConflictException('Invalid number of userIds');
  }

  async getUserRooms(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: Partial<Room & { name: string }>[]; meta: { total: number; page: number; limit: number } }> {
    // get room IDs and total count
    const { roomIds } = await this.memberService.findMemberships(userId, page, limit);

    // fetch room documents
    const rooms = await this.roomModel
      .find({ _id: { $in: roomIds }, deleted_at: { $exists: false } })
      .sort({ created_at: -1 })
      .lean();

    const total = rooms.length;
    // process single-chat names
    const processed = await Promise.all(
      rooms.map(async room => {
        if (room.type === 'single') {
          // Check default naming pattern userA & userB
          const sep = ' & ';
          if (room.name && room.name.includes(sep)) {
            // fetch both members with populated user data
            const { members } = await this.memberService.findRoomMembers(room._id.toString(), 1, 2);
            // find the other member
            const other = members.find(m => m.user && m.user._id.toString() !== userId);
            if (other?.user && 'username' in other.user) {
              // prefer nickname over username
              return { ...room, name: (other.nickname || other.user.username) as string };
            }
          }
        }
        return { ...room, name: room.name as string };
      }),
    );

    return {
      data: processed,
      meta: { total, page, limit },
    };
  }
}

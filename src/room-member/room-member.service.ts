import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RoomMember, RoomMemberDocument } from './room-member.schema';

@Injectable()
export class RoomMemberService {
  constructor(
    @InjectModel(RoomMember.name)
    private memberModel: Model<RoomMemberDocument>,
  ) {}

  /**
   * Find an existing single‐chat membership shared by all of the given users.
   * Returns the first matching RoomMember doc 
   */
  async findByUsersAndFlag(
    userIds: string[],
    singleChat: boolean,
  ): Promise<RoomMemberDocument | null> {
    // fetch all membership records for these users with the singleChat flag
    const members = await this.memberModel.find({
      user: { $in: userIds.map((id) => new Types.ObjectId(id)) },
      singleChat,
    }).lean();

    // group by room id
    const counts = members.reduce((acc, mem) => {
      const key = mem.room.toHexString();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // find a room where count === number of users
    const sharedRoomId = Object.entries(counts).find(
      ([, cnt]) => cnt === userIds.length,
    )?.[0];

    if (!sharedRoomId) return null;

    // return any one of the member docs in that room
    return this.memberModel.findOne({
      room: new Types.ObjectId(sharedRoomId),
      singleChat,
    });
  }

  // create a new room member
  async create(
    roomId: string,
    userId: string,
    role: 'admin' | 'normal',
    singleChat: boolean,
    nickname?: string,
  ): Promise<RoomMember> {
    const created = await this.memberModel.create({
      room:       new Types.ObjectId(roomId),
      user:       new Types.ObjectId(userId),
      role,
      nickname,
      singleChat,
      // joined_at auto
    });
    return created.toObject();
  }

  /**
   * Add multiple users into a group room.
   * - skips users already in the room (left_at is null)
   * - re-activates users who left if they're not banned
   * - throws if user was banned
   */
  async addMembers(
    roomId: string,
    userIds: string[],
  ): Promise<RoomMember[]> {
    const roomObjId = new Types.ObjectId(roomId);

    const results: RoomMember[] = [];
    for (const uid of userIds) {
      const uObj = new Types.ObjectId(uid);

      // see if there is an existing member record
      const existing = await this.memberModel.findOne({
        room: roomObjId,
        user: uObj,
      });

      if (existing) {
        if (!existing.left_at) {
          // still in the room
          continue;
        }
        if (existing.banned_at) {
          throw new ForbiddenException(`User ${uid} is banned`);
        }
        // they left before but aren't banned -> rejoining is possible
        existing.left_at = undefined;
        await existing.save();
        results.push(existing.toObject());
        continue;
      }

      // brand new member
      const created = await this.memberModel.create({
        room: roomObjId,
        user: uObj,
        role: 'normal',
        singleChat: false,
        // joined_at auto
      });
      results.push(created.toObject());
    }

    return results;
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const roomObj = new Types.ObjectId(roomId);
    const userObj = new Types.ObjectId(userId);

    const updated = await this.memberModel.findOneAndUpdate(
      { room: roomObj, user: userObj },
      { $set: { left_at: new Date() } },
      { new: true },
    );

    if (!updated) {
      throw new BadRequestException('Not a member of this room');
    }
  }

  // find a single room member record
  async findOne(roomId: string, userId: string): Promise<RoomMemberDocument> {
    let roomObj: Types.ObjectId;
    let userObj: Types.ObjectId;
  
    try {
      roomObj = new Types.ObjectId(roomId);
      userObj = new Types.ObjectId(userId);
    } catch {
      throw new BadRequestException('Invalid room or user ID');
    }
  
    const rec = await this.memberModel.findOne({
      room: roomObj,
      user: userObj,
    });
  
    if (!rec) {
      throw new BadRequestException('User not in room');
    }
    return rec;
  }

  // Flip banned_at: if not present -> set now; if present -> clear
  async toggleBan(roomId: string, targetUserId: string): Promise<RoomMember> {
    const rec = await this.findOne(roomId, targetUserId);
  
    if (rec.banned_at) {
      rec.banned_at = undefined;
    } else {
      rec.banned_at = new Date();
    }
    await rec.save();
    return rec.toObject();
  }

  async findMemberships(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ roomIds: Types.ObjectId[]; total: number }> {
    let userObj: Types.ObjectId;
    try {
      userObj = new Types.ObjectId(userId);
    } catch {
      throw new BadRequestException('Invalid user ID');
    }

    // find all memberships
    const membershipQuery = { user: userObj };
    const allMemberships = await this.memberModel.find(membershipQuery).select('room').lean();
    const roomIdsAll = allMemberships.map(m => m.room as Types.ObjectId);

    // filter out deleted rooms in service consumer (RoomService)
    return { roomIds: roomIdsAll, total: roomIdsAll.length };
  }

  async findRoomMembers(
    roomId: string,
    page = 1,
    limit = 10,
  ): Promise<{ members: Partial<RoomMember>[]; total: number }> {
    let roomObj: Types.ObjectId;
    try {
      roomObj = new Types.ObjectId(roomId);
    } catch {
      throw new BadRequestException('Invalid room ID');
    }

    const baseQuery: any = { room: roomObj };
    // exclude left members
    baseQuery.left_at = { $exists: false };

    const total = await this.memberModel.countDocuments(baseQuery);
    const raw = await this.memberModel
      .find(baseQuery)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'username profilePic handleName')
      .lean();

    const members = raw.map(m => ({
      _id: m._id,
      room: m.room,
      user: m.user,
      role: m.role,
      nickname: m.nickname,
      singleChat: m.singleChat,
      joined_at: m.joined_at,
      banned_at: m.banned_at,
    }));

    return { members, total };
  }  

  // check valid membership 
  async ensureMember(roomId: string, userId: string): Promise<void> {
    const rec = await this.findOne(roomId, userId);
    if (rec.left_at) {
      throw new BadRequestException('User has left the room');
    }
    if (rec.banned_at) {
      throw new ForbiddenException('User is banned from this room');
    }
  }

  async updateNickname(
    roomId: string,
    targetUserId: string,
    nickname: string,
  ): Promise<RoomMember> {
    if (typeof nickname !== 'string' || nickname.length > 40) {
      throw new BadRequestException('Nickname must be a string up to 40 characters');
    }
    const rec = await this.findOne(roomId, targetUserId);
    if (rec.left_at || rec.banned_at) {
      throw new BadRequestException('Cannot set nickname for left or banned user');
    }
    rec.nickname = nickname;
    await rec.save();
    return rec.toObject();
  }

  async toggleNotification(
    roomId: string,
    targetUserId: string,
  ): Promise<RoomMember> {
    const rec = await this.findOne(roomId, targetUserId);
    if (rec.left_at || rec.banned_at) {
      throw new BadRequestException('Cannot toggle notification for left or banned user');
    }
    rec.is_notified = !rec.is_notified;
    await rec.save();
    return rec.toObject();
  }
}

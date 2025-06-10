import { 
  Controller, 
  Post, 
  Param, 
  Body, 
  UseGuards, 
  ForbiddenException,
  Patch,
  Query,
  Get,
} from '@nestjs/common';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RoomMemberService } from './room-member.service';
import { RelationService } from 'src/relation/relation.service';
import { RoomService } from '../room/room.service';
import { CreateRoomDto } from '../room/dto/create-room.dto';

  @Controller('room-members')
  @UseGuards(JwtRefreshAuthGuard)
  export class RoomMemberController {
    constructor(
      private readonly memberService: RoomMemberService,
      private readonly roomService: RoomService,
      private readonly relationService: RelationService,
    ) {}
  
    @Post('add-members')
    async addMembers(
    @CurrentUser('sub') userId: string,
    @Query('roomId')     roomId: string,
    @Body() dto: CreateRoomDto,
    ) {
    const room = await this.roomService.getById(roomId);
    if (room.type !== 'group') {
        throw new ForbiddenException('Cannot add members to a single chat');
    }
    if (room.deleted_at) {
        throw new ForbiddenException('Room is deleted');
    }

    const added = await this.memberService.addMembers(roomId, dto.userIds);

    // if nothing was added, they must already all be in the room
    if (added.length === 0) {
        return {
        message: 'All specified users are already members of this room',
        userIds: dto.userIds,
        };
    }

    // otherwise return the newly added or rejoined members as before
    return added;
  } 

  @Patch('leave')
  async leaveGroup(
    @CurrentUser('sub') userId: string,
    @Query('roomId') roomId: string,
  ) {
    const room = await this.roomService.getById(roomId);
    if (room.type !== 'group') {
      throw new ForbiddenException('Cannot leave a single chat');
    }

    await this.memberService.leaveRoom(roomId, userId);
    return { message: 'Successfully left the group' };
  }

  @Patch('ban')
  async toggleBan(
    @CurrentUser('sub') userId: string,
    @Body('roomId')       roomId: string,
    @Body('targetUserId') targetUserId: string,
  ) {
    const room = await this.roomService.getById(roomId);
    if (room.type !== 'group') {
      throw new ForbiddenException('Cannot ban in a single chat');
    }

    // verify current user is admin
    const you = await this.memberService.findOne(roomId, userId);
    if (you.role !== 'admin') {
      throw new ForbiddenException('Only admins can ban users');
    }

    return this.memberService.toggleBan(roomId, targetUserId);
  }  

  /**
   * GET /room-members?roomId=&page=&limit=
   * for group: paginated list of all members
   * for single: return the other user only
   */
// room-member.controller.ts
  @Get('all')
  async getMembers(
    @CurrentUser('sub') currentUserId: string,
    @Query('roomId') roomId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const room = await this.roomService.getById(roomId);
    const p = parseInt(page, 10);
    const l = parseInt(limit, 10);
    
    if (room.type === 'single') {
      // fetch up to two members
      const { members } = await this.memberService.findRoomMembers(roomId, 1, 2);
      // identify the other participant
      const otherMember = members.find(m => (m.user as any)._id.toString() !== currentUserId);
      if (!otherMember) {
        throw new ForbiddenException('Could not find the other chat participant');
      }
      const user = otherMember.user as any;
      // determine follow status
      let isFollowing = false;
      if (currentUserId !== user._id.toString()) {
        const { relation, userOneIsActing } =
          await this.relationService.getRelation(currentUserId, user._id.toString());
        if (relation) {
          const [oneRel, twoRel] = (relation as string).split('_');
          isFollowing = userOneIsActing ? oneRel === 'FOLLOW' : twoRel === 'FOLLOW';
        }
      }
      return {
        data: {
          userId: user._id.toString(),
          username: user.username,
          handleName: user.handleName,
          profilePic: user.profilePic,
          nickname: otherMember.nickname || '',
          isFollowing,
        },
      };
    }
    
    // group chat: paginated with follow status
    const { members, total } = await this.memberService.findRoomMembers(roomId, p, l);
    
    // Get follow status for each member
    const membersWithFollowStatus = await Promise.all(
      members.map(async (m) => {
        const user = m.user as any;
        let isFollowing = false;
        
        // Don't check follow status for the current user
        if (currentUserId !== user._id.toString()) {
          try {
            const { relation, userOneIsActing } =
              await this.relationService.getRelation(currentUserId, user._id.toString());
            if (relation) {
              const [oneRel, twoRel] = (relation as string).split('_');
              isFollowing = userOneIsActing ? oneRel === 'FOLLOW' : twoRel === 'FOLLOW';
            }
          } catch (error) {
            // Log error but don't fail the entire request
            console.warn(`Failed to get relation for user ${user._id}:`, error);
          }
        }
        
        return {
          user: m.user,
          role: m.role,
          joined_at: m.joined_at,
          left_at: m.left_at,
          banned: m.banned_at instanceof Date,
          nickname: m.nickname || '',
          isFollowing,
        };
      })
    );
    
    return {
      data: membersWithFollowStatus,
      meta: { total, page: p, limit: l },
    };
  }

  // edit a user nickname in chat room
  @Patch('nickname')
  async editNickname(
    @CurrentUser('sub') userId: string,
    @Body('roomId') roomId: string,
    @Body('targetUserId') targetUserId: string,
    @Body('nickname') nickname: string,
  ) {
    const room = await this.roomService.getById(roomId);
    if (room.type !== 'group') {
      throw new ForbiddenException('Cannot set nickname in a single chat');
    }
    if (room.deleted_at) {
      throw new ForbiddenException('Room is deleted');
    }

    // Optionally verify current user is a member
    await this.memberService.ensureMember(roomId, userId);

    const updated = await this.memberService.updateNickname(
      roomId,
      targetUserId,
      nickname,
    );
    return { message: 'Nickname updated', member: updated };
  }

  // toggle notifications from users
  @Patch('notify')
  async toggleNotification(
    @CurrentUser('sub') userId: string,
    @Body('roomId') roomId: string,
    @Body('targetUserId') targetUserId: string,
  ) {
    const room = await this.roomService.getById(roomId);
    if (room.type !== 'group') {
      throw new ForbiddenException('Cannot toggle notifications in a single chat');
    }
    if (room.deleted_at) {
      throw new ForbiddenException('Room is deleted');
    }

    // Optionally verify current user is a member
    await this.memberService.ensureMember(roomId, userId);

    const updated = await this.memberService.toggleNotification(
      roomId,
      targetUserId,
    );
    return { message: 'Notification setting toggled', member: updated };
  }
}

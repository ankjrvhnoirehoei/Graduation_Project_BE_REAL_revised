import {
  Controller,
  Post,
  Get,
  UseGuards,
  Body,
  Put,
  Query,
  BadRequestException,
  Param,
  Req,
} from '@nestjs/common';
import { RelationService } from './relation.service';
import { RelationType } from './relation.schema';
import { UpsertRelationDto } from './dto/upsert-relation.dto';
import { ListRelationDto } from './dto/list-relation.dto';
import { GetFollowersDto } from './dto/get-followers.dto';
import { GetFollowingDto } from './dto/get-following.dto';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { GetBlockingDto } from './dto/get-blocking.dto';
import { UserService } from '../user/user.service';
import { NotificationService } from 'src/notification/notification.service';
import { Types } from 'mongoose';

@Controller('relations')
export class RelationController {
  constructor(
    private readonly relationService: RelationService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
  ) { }

  /**
   * PUT /relations/relation-action
   * body: { targetId: string, action: 'follow'|'unfollow'|'block'|'unblock' }
   *
   * Uses JwtRefreshAuthGuard (access token), and pulls the acting user's ID
   * from @CurrentUser('sub').
   */
  @UseGuards(JwtRefreshAuthGuard)
  @Put('relation-action')
  async upsert(@CurrentUser('sub') me: string, @Body() dto: UpsertRelationDto) {
    const { targetId, action } = dto;

    if (me === targetId) {
      throw new BadRequestException('Cannot follow/block yourself');
    }
    if (!['follow', 'unfollow', 'block', 'unblock'].includes(action)) {
      throw new BadRequestException('Invalid action');
    }

    const rel = await this.relationService.createOrUpdateRelation(
      me,
      targetId,
      action,
    );
    return rel
      ? { relation: rel.relation as RelationType, updatedAt: rel.updated_at }
      : { relation: 'NULL_NULL', message: 'No relationship exists anymore' };
  }

  /**
   * GET /relations/get-relation?filter=followers|following|blockers|blocking
   *
   * Returns all relation‐records matching “filter” for the currently logged‐in user.
   * Uses JwtRefreshAuthGuard and @CurrentUser('sub') to get userId.
   */
  @UseGuards(JwtRefreshAuthGuard)
  @Get('get-relation')
  async list(
    @CurrentUser('sub') userId: string,
    @Query() dto: ListRelationDto,
  ) {
    const { filter } = dto;
    const records = await this.relationService.findByUserAndFilter(
      userId,
      filter,
    );

    return records.map((r) => ({
      userOneID: r.userOneID,
      userTwoID: r.userTwoID,
      relation: r.relation,
      createdAt: r.created_at,
      updatedAt: (r as any).updated_at,
    }));
  }

  @UseGuards(JwtRefreshAuthGuard)
  @Post('followers')
  async getFollowers(@Body() dto: GetFollowersDto) {
    const { userId } = dto;

    // fetch all relationship records where someone follows `userId`
    const records = await this.relationService.findByUserAndFilter(
      userId,
      'followers',
    );

    // map each record to the follower's ID
    const followerIds = records.map((r) => {
      const u1 = r.userOneID.toString();
      const u2 = r.userTwoID.toString();

      // Check which pattern matched and return the correct follower
      if (u2 === userId && r.relation.startsWith('FOLLOW_')) {
        return u1;
      } else if (u1 === userId && r.relation.endsWith('_FOLLOW')) {
        return u2;
      }
      throw new BadRequestException('Unexpected relation pattern in followers');
    });

    // Remove duplicates
    const uniqueFollowerIds = [...new Set(followerIds)];

    // Fetch detailed user information
    const followers = await Promise.all(
      uniqueFollowerIds.map((id) => this.userService.getUserById(id)),
    );

    console.log('Request Body:', dto);
    console.log('Followers count:', uniqueFollowerIds.length);

    return { userId, followers };
  }

  @UseGuards(JwtRefreshAuthGuard)
  @Post('following')
  async getFollowing(@Body() dto: GetFollowingDto) {
    const { userId } = dto;

    // fetch all relationship records where userId follows someone
    const records = await this.relationService.findByUserAndFilter(
      userId,
      'following',
    );

    // map each record to the followed user's ID
    const followingIds = records.map((r) => {
      const u1 = r.userOneID.toString();
      const u2 = r.userTwoID.toString();

      // Check which pattern matched and return the correct following
      if (u1 === userId && r.relation.startsWith('FOLLOW_')) {
        return u2;
      } else if (u2 === userId && r.relation.endsWith('_FOLLOW')) {
        return u1;
      }
      throw new BadRequestException('Unexpected relation pattern in following');
    });

    // Remove duplicates
    const uniqueFollowingIds = [...new Set(followingIds)];

    // Fetch detailed user information
    const following = await Promise.all(
      uniqueFollowingIds.map((id) => this.userService.getUserById(id)),
    );

    console.log('Request Body:', dto);
    console.log('Following count:', uniqueFollowingIds.length);

    return { userId, following };
  }

  /**
   * POST /relations/blocking
   * body: { userId: string }
   *
   * Returns an array of "who userId is blocking."
   * Also protected by JwtRefreshAuthGuard.
   */
  @UseGuards(JwtRefreshAuthGuard)
  @Post('blocking')
  async getBlocking(@Body() dto: GetBlockingDto) {
    const { userId } = dto;

    // fetch all relationship records where userId blocks someone
    const records = await this.relationService.findByUserAndFilter(
      userId,
      'blocking',
    );

    // map each record to the blocked-user's ID
    const blockingIds = records.map((r) => {
      const u1 = r.userOneID.toString();
      const u2 = r.userTwoID.toString();
      // if userId is in userTwoID, then userId blocks userOneID; otherwise userId blocks userTwoID
      return u2 === userId ? u1 : u2;
    });

    // Fetch detailed user information
    const blocking = await Promise.all(
      blockingIds.map((id) => this.userService.getUserById(id)),
    );

    return { userId, blocking };
  }

  /**
   * GET /relations/recommendations?limit=10
   * Protected. Returns up to `limit` users recommended to follow.
   */
  @UseGuards(JwtRefreshAuthGuard)
  @Get('recommendations')
  async recommendations(
    @CurrentUser('sub') userId: string,
    @Query('limit') limitQ?: string,
  ) {
    const limit = limitQ ? parseInt(limitQ, 10) : 10;
    if (isNaN(limit) || limit <= 0) {
      throw new BadRequestException('`limit` must be a positive integer');
    }

    const recIds = await this.relationService.getRecommendations(
      userId,
      Math.min(limit, 10),
    );

    if (recIds.length === 0) {
      return {
        message:
          'No recommendations available. Follow more users to get suggestions.',
      };
    }

    const recommendations = await Promise.all(
      recIds.map((id) => this.userService.getUserById(id)),
    );

    return { recommendations };
  }

  @UseGuards(JwtRefreshAuthGuard)
  @Post('followers/send-notification')
  async notifyFollowersPost(
    @CurrentUser('sub') userId: string,
    @Body() input: { title: string; body: string; data?: any },
  ): Promise<{ success: boolean; followers?: any; error?: string }> {
    try {
      const followers = await this.relationService.getFollowers(userId);
      if (!followers.length) return { success: true, followers: [] };

      await this.notificationService.sendPushNotification(
        followers,
        userId,
        input.title || 'Thông báo mới',
        input.body || 'Bạn có thông báo từ người bạn đang theo dõi',
        input.data || {},
      );

      return { success: true, followers };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * This controller will get relationship between two user
   */
  @Get('/:fromUserId/:toUserId')
  async getRelationShip(
    @Param('fromUserId') fromUserId: string,
    @Param('toUserId') toUserId: string,
  ) {
    if (!Types.ObjectId.isValid(fromUserId) || !Types.ObjectId.isValid(toUserId)) {
      return {
        message: 'Invalid user ID format',
        data: null,
      };
    }
    return await this.relationService.getRelationShip(fromUserId, toUserId);
  }

}

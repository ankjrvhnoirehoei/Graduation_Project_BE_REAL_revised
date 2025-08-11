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
   */
  @UseGuards(JwtRefreshAuthGuard)
  @Put('relation-action')
  async upsert(@CurrentUser('sub') me: string, @Body() dto: UpsertRelationDto) {
    const { targetId, action } = dto;

    if (me === targetId) {
      throw new BadRequestException('Không thể follow chính mình.');
    }
    if (!['follow', 'unfollow', 'block', 'unblock'].includes(action)) {
      throw new BadRequestException('Action sai.');
    }

    const rel = await this.relationService.createOrUpdateRelation(
      me,
      targetId,
      action,
    );
    return rel
      ? { relation: rel.relation as RelationType, updatedAt: rel.updated_at }
      : { relation: 'NULL_NULL', message: 'Không có mối quan hệ nào.' };
  }

  /**
   * GET /relations/get-relation?filter=followers|following|blockers|blocking
   * Returns all relation‐records matching “filter” for the currently logged‐in user.
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
  async getFollowers(
    @Body() dto: GetFollowersDto,
    @Query('page') pageQ?: string,
    @Query('limit') limitQ?: string,
  ) {
    const { userId } = dto;
    const page = Math.max(parseInt(pageQ ?? '1', 10), 1);
    const limit = Math.max(parseInt(limitQ ?? '20', 10), 1);

    const records = await this.relationService.findByUserAndFilter(userId, 'followers');
    const followerIds = records.map((r) => {
      const u1 = r.userOneID.toString();
      const u2 = r.userTwoID.toString();
      if (u2 === userId && r.relation.startsWith('FOLLOW_')) return u1;
      else if (u1 === userId && r.relation.endsWith('_FOLLOW')) return u2;
      throw new BadRequestException('Mối quan hệ bất hợp lệ.');
    });
    const uniqueFollowerIds = [...new Set(followerIds)];
    const totalCount = uniqueFollowerIds.length;
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    const pagedIds = uniqueFollowerIds.slice((page - 1) * limit, page * limit);
    const followers = await this.userService.findManyByIds(pagedIds);

    return {
      userId,
      followers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  @UseGuards(JwtRefreshAuthGuard)
  @Post('following')
  async getFollowing(
    @Body() dto: GetFollowingDto,
    @Query('page') pageQ?: string,
    @Query('limit') limitQ?: string,
  ) {
    const { userId } = dto;
    const page = Math.max(parseInt(pageQ ?? '1', 10), 1);
    const limit = Math.max(parseInt(limitQ ?? '20', 10), 1);

    const records = await this.relationService.findByUserAndFilter(userId, 'following');
    const followingIds = records.map((r) => {
      const u1 = r.userOneID.toString();
      const u2 = r.userTwoID.toString();
      if (u1 === userId && r.relation.startsWith('FOLLOW_')) return u2;
      else if (u2 === userId && r.relation.endsWith('_FOLLOW')) return u1;
      throw new BadRequestException('Mối quan hệ bất hợp lệ.');
    });
    const uniqueFollowingIds = [...new Set(followingIds)];
    const totalCount = uniqueFollowingIds.length;
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    const pagedIds = uniqueFollowingIds.slice((page - 1) * limit, page * limit);
    const following = await this.userService.findManyByIds(pagedIds);

    return {
      userId,
      following,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * POST /relations/blocking
   * body: { userId: string }
   * Returns an array of "who userId is blocking."
   */
  @UseGuards(JwtRefreshAuthGuard)
  @Post('blocking')
  async getBlocking(
    @Body() dto: GetBlockingDto,
    @Query('page') pageQ?: string,
    @Query('limit') limitQ?: string,
  ) {
    const { userId } = dto;
    const page = Math.max(parseInt(pageQ ?? '1', 10), 1);
    const limit = Math.max(parseInt(limitQ ?? '20', 10), 1);

    const records = await this.relationService.findByUserAndFilter(userId, 'blocking');
    const blockingIds = records.map((r) => {
      const u1 = r.userOneID.toString();
      const u2 = r.userTwoID.toString();
      return u2 === userId ? u1 : u2;
    });
    const uniqueBlockingIds = [...new Set(blockingIds)];
    const totalCount = uniqueBlockingIds.length;
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    const pagedIds = uniqueBlockingIds.slice((page - 1) * limit, page * limit);
    const blocking = await this.userService.findManyByIds(pagedIds);

    return {
      userId,
      blocking,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  @UseGuards(JwtRefreshAuthGuard)
  @Post('blockers')
  async getBlockers(
    @Body() dto: GetBlockingDto,
    @Query('page') pageQ?: string,
    @Query('limit') limitQ?: string,
  ) {
    const { userId } = dto;
    const page = Math.max(parseInt(pageQ ?? '1', 10), 1);
    const limit = Math.max(parseInt(limitQ ?? '20', 10), 1);

    const records = await this.relationService.findByUserAndFilter(userId, 'blockers');
    const blockerIds = records.map((r) => {
      const u1 = r.userOneID.toString();
      const u2 = r.userTwoID.toString();
      return u2 === userId ? u1 : u2;
    });
    const uniqueBlockerIds = [...new Set(blockerIds)];
    const totalCount = uniqueBlockerIds.length;
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    const pagedIds = uniqueBlockerIds.slice((page - 1) * limit, page * limit);
    const blockers = await this.userService.findManyByIds(pagedIds);

    return {
      userId,
      blockers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
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
      throw new BadRequestException('`limit` phải là số nguyên dương');
    }

    const recIds = await this.relationService.getRecommendations(
      userId,
      Math.min(limit, 10),
    );

    if (recIds.length === 0) {
      return {
        message:
          'Không có đề xuất. Theo dõi thêm nhiều người khác để có đề xuất.',
      };
    }

    const recommendations = await this.userService.findManyByIds(recIds);

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

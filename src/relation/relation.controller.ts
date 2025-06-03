import {
  Controller,
  Post,
  Get,
  UseGuards,
  Body,
  Put,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { RelationService } from './relation.service';
import { RelationType } from './relation.schema';
import { UpsertRelationDto } from './dto/upsert-relation.dto';
import { ListRelationDto }   from './dto/list-relation.dto';
import { GetFollowersDto } from './dto/get-followers.dto';
import { GetFollowingDto } from './dto/get-following.dto';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('relations')
export class RelationController {
  constructor(private readonly relationService: RelationService) {}

  /**
   * PUT /relations/relation-action
   * body: { targetId: string, action: 'follow'|'unfollow'|'block'|'unblock' }
   *
   * Uses JwtRefreshAuthGuard (access token), and pulls the acting user's ID
   * from @CurrentUser('sub').
   */
  @UseGuards(JwtRefreshAuthGuard)
  @Put('relation-action')
  async upsert(
    @CurrentUser('sub') me: string,
    @Body() dto: UpsertRelationDto,
  ) {
    const { targetId, action } = dto;

    if (me === targetId) {
      throw new BadRequestException('Cannot follow/block yourself');
    }
    if (!['follow','unfollow','block','unblock'].includes(action)) {
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

    return records.map(r => ({
      userOneID: r.userOneID,
      userTwoID: r.userTwoID,
      relation: r.relation,
      createdAt: r.created_at,
      updatedAt: (r as any).updated_at,
    }));
  }

  /**
   * POST /relations/followers
   * body: { userId: string }
   *
   * Returns an array of “who follows userId”.
   * This is still a protected route (only an authenticated user can call).
   */
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
    const followers = records.map(r => {
      const u1 = r.userOneID.toString();
      const u2 = r.userTwoID.toString();
      // if userId is in userTwoID, follower is userOneID; otherwise follower is userTwoID
      return u2 === userId ? u1 : u2;
    });

    return { userId, followers };
  }

  /**
   * POST /relations/following
   * body: { userId: string }
   *
   * Returns an array of “who userId is following.”
   * Also protected by JwtRefreshAuthGuard.
   */
  @UseGuards(JwtRefreshAuthGuard)
  @Post('following')
  async getFollowing(@Body() dto: GetFollowingDto) {
    const { userId } = dto;

    // fetch all relationship records where userId follows someone
    const records = await this.relationService.findByUserAndFilter(
      userId,
      'following',
    );

    // map each record to the followed‐user’s ID
    const following = records.map(r => {
      const u1 = r.userOneID.toString();
      const u2 = r.userTwoID.toString();
      // if userId is in userTwoID, then userId follows userOneID; otherwise userId follows userTwoID
      return u2 === userId ? u1 : u2;
    });

    return { userId, following };
  }
}

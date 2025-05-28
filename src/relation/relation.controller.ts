import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  Put,
  Query,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from '@app/common';
import { RelationService } from './relation.service';
import { RelationType } from './relation.schema';
import { UpsertRelationDto } from './dto/upsert-relation.dto';
import { ListRelationDto }   from './dto/list-relation.dto';
import { GetFollowersDto } from './dto/get-followers.dto';

@Controller('relations')
export class RelationController {
  constructor(private readonly relationService: RelationService) {}

  /**
   * PUT /relations/relation-action
   * body: { action: 'follow'|'unfollow'|'block'|'unblock' }
   */
  @UseGuards(JwtAuthGuard)
  @Put('relation-action')
  async upsert(
    @Request() req,
    @Body() dto: UpsertRelationDto,
  ) {
    const me = (req.user as any)._id.toString();
    const { targetId, action } = dto;
    if (me === targetId) {
      throw new BadRequestException('Cannot follow/block yourself');
    }
    if (!['follow','unfollow','block','unblock'].includes(action)) {
      throw new BadRequestException('Invalid action');
    }

    const rel = await this.relationService.createOrUpdateRelation(me, targetId, action);
    return rel
      ? { relation: rel.relation as RelationType, updatedAt: rel.updated_at }
      : { relation: 'NULL_NULL', message: 'No relationship exists anymore' };
  }

  // GET /relations/get-relation?filter=followers|following|blockers|blocking
  @UseGuards(JwtAuthGuard)
  @Get('/get-relation')
  async list(
    @Request() req,
    @Query() dto: ListRelationDto,
  ) {
    const userId = (req.user as any)._id.toString();
    const { filter } = dto;
    const records = await this.relationService.findByUserAndFilter(userId, filter);
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
   */
  @UseGuards(JwtAuthGuard)
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
}
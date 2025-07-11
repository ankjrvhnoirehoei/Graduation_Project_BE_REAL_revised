import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Relation, RelationDocument, RelationType } from './relation.schema';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class RelationService {
  constructor(
    @InjectModel(Relation.name) private relationModel: Model<RelationDocument>,
    private readonly notificationService: NotificationService,
  ) {}

  // create, update or delete the relation from A->B 
  async createOrUpdateRelation(
    actingUserId: string,
    targetUserId: string,
    action: 'follow' | 'unfollow' | 'block' | 'unblock',
  ): Promise<Relation | null> {
    if (actingUserId === targetUserId) {
      throw new BadRequestException('Cannot perform action on yourself');
    }
    if (!Types.ObjectId.isValid(actingUserId) || !Types.ObjectId.isValid(targetUserId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const actingUser = new Types.ObjectId(actingUserId);
    const targetUser = new Types.ObjectId(targetUserId);
    const [userOneId, userTwoId] =
      actingUserId < targetUserId
        ? [actingUser, targetUser]
        : [targetUser, actingUser];
    const actingIsOne = actingUserId < targetUserId;

    // Fetch existing state
    const existing = await this.relationModel.findOne({ userOneID: userOneId, userTwoID: userTwoId });
    const oldRel = existing ? existing.relation : 'NULL_NULL';

    // Retry loop
    const maxRetries = 3;
    let result: Relation | null = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        result = await this.performRelationUpdate(userOneId, userTwoId, actingIsOne, action);
        break;
      } catch (err: any) {
        if (err.code === 11000 && attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          continue;
        }
        throw err;
      }
    }
    if (!result) return null;

    // Determine new relation string
    const newRel = result.relation;

    // Handle follow notification
    if (action === 'follow') {
      const becameFollow = actingIsOne
        ? !oldRel.startsWith('FOLLOW_') && newRel.startsWith('FOLLOW_')
        : !oldRel.endsWith('_FOLLOW')   && newRel.endsWith('_FOLLOW');
      if (becameFollow) {
        await this.notificationService.notifyFollow(actingUserId, targetUserId);
      }
    }

    // Handle unfollow: retract notification
    if (action === 'unfollow') {
      const wasFollow = actingIsOne
        ? oldRel.startsWith('FOLLOW_') && !newRel.startsWith('FOLLOW_')
        : oldRel.endsWith('_FOLLOW')   && !newRel.endsWith('_FOLLOW');
      if (wasFollow) {
        await this.notificationService.retractFollow(actingUserId, targetUserId);
      }
    }


    return result;
  }

  private async performRelationUpdate(
    userOneId: Types.ObjectId,
    userTwoId: Types.ObjectId,
    actingUserIsUserOne: boolean,
    action: 'follow' | 'unfollow' | 'block' | 'unblock',
  ): Promise<Relation | null> {
    // Fetch existing relation (if any)
    const existing = await this.relationModel
      .findOne({ userOneID: userOneId, userTwoID: userTwoId })
      .exec();

    // Parse existing relation states, default to NULL
    let oneRel: 'FOLLOW' | 'BLOCK' | 'NULL' = 'NULL';
    let twoRel: 'FOLLOW' | 'BLOCK' | 'NULL' = 'NULL';
    
    if (existing && existing.relation) {
      const parts = existing.relation.split('_');
      if (parts.length === 2) {
        oneRel = parts[0] as typeof oneRel;
        twoRel = parts[1] as typeof twoRel;
      }
    }

    // Determine new action state
    let newActionState: 'FOLLOW' | 'BLOCK' | 'NULL';
    switch (action) {
      case 'follow':
        newActionState = 'FOLLOW';
        break;
      case 'unfollow':
      case 'unblock':
        newActionState = 'NULL';
        break;
      case 'block':
        newActionState = 'BLOCK';
        break;
      default:
        throw new NotFoundException(`Unknown action ${action}`);
    }

    // Update the correct side based on who is acting
    if (actingUserIsUserOne) {
      oneRel = newActionState;
    } else {
      twoRel = newActionState;
    }

    // If both sides are NULL → remove the record
    if (oneRel === 'NULL' && twoRel === 'NULL') {
      if (existing) {
        try {
          await this.relationModel.deleteOne({ _id: existing._id }).exec();
        } catch (error) {
          // Log error but don't throw - the logical state is correct
          console.warn('Failed to delete relation record:', error);
        }
      }
      return null;
    }

    // Validate relation state
    if (!['FOLLOW', 'BLOCK', 'NULL'].includes(oneRel) || 
        !['FOLLOW', 'BLOCK', 'NULL'].includes(twoRel)) {
      throw new BadRequestException('Invalid relation state');
    }

    // Upsert the relation with consistent ordering
    const newRelation = `${oneRel}_${twoRel}` as RelationType;
    
    try {
      return await this.relationModel
        .findOneAndUpdate(
          { userOneID: userOneId, userTwoID: userTwoId },
          { 
            relation: newRelation,
            updated_at: new Date()
          },
          { 
            upsert: true, 
            new: true, 
            setDefaultsOnInsert: true,
            runValidators: true
          },
        )
        .exec();
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error - let retry logic handle it
        throw error;
      }
      throw new BadRequestException('Failed to update relation');
    }
  }

  // Helper method to get relation between two users
  async getRelation(userOneId: string, userTwoId: string): Promise<{
    relation: RelationType | null;
    userOneIsActing: boolean;
  }> {
    if (!Types.ObjectId.isValid(userOneId) || !Types.ObjectId.isValid(userTwoId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const u1Str = new Types.ObjectId(userOneId).toString();
    const u2Str = new Types.ObjectId(userTwoId).toString();
    
    const userOneId_ordered = u1Str < u2Str ? new Types.ObjectId(userOneId) : new Types.ObjectId(userTwoId);
    const userTwoId_ordered = u1Str < u2Str ? new Types.ObjectId(userTwoId) : new Types.ObjectId(userOneId);
    
    const relation = await this.relationModel
      .findOne({ userOneID: userOneId_ordered, userTwoID: userTwoId_ordered })
      .exec();

    return {
      relation: relation?.relation || null,
      userOneIsActing: u1Str < u2Str
    };
  }

  // Fetch all relations for `userId`, filtered by one of four types 
  async findByUserAndFilter(
    userId: string,
    filter: 'followers' | 'following' | 'blockers' | 'blocking',
  ): Promise<RelationDocument[]> {
    const u = new Types.ObjectId(userId);
    const or: any[] = [];

    switch (filter) {
      case 'followers':
        // A's followers = others who follow A
        or.push(
          { userTwoID: u, relation: { $regex: '^FOLLOW_' } },  // B->A
          { userOneID: u, relation: { $regex: '_FOLLOW$' } },  // A->B but B->A
        );
        break;

      case 'following':
        // whom A follows
        or.push(
          { userOneID: u, relation: { $regex: '^FOLLOW_' } },  // A->B
          { userTwoID: u, relation: { $regex: '_FOLLOW$' } },  // B->A but A->B
        );
        break;

      case 'blockers':
        // users who block A
        or.push(
          { userTwoID: u, relation: { $regex: '^BLOCK_' } },
          { userOneID: u, relation: { $regex: '_BLOCK$' } },
        );
        break;

      case 'blocking':
        // whom A blocks
        or.push(
          { userOneID: u, relation: { $regex: '^BLOCK_' } },
          { userTwoID: u, relation: { $regex: '_BLOCK$' } },
        );
        break;

      default:
        throw new NotFoundException(`Unknown filter ${filter}`);
    }

    return this.relationModel.find({ $or: or }).exec();
  }

  /**
   * Get up to 'limit' (10) user IDs recommended for `userId` to follow.
   * Recommendations are second-degree connections (followers/followings of your followings),
   * excluding anyone you already follow or have blocked/been blocked by.
   */
  async getRecommendations(userId: string, limit = 10): Promise<string[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }
    const u = new Types.ObjectId(userId);

    // 1. Direct followings of U
    const followingRecords = await this.findByUserAndFilter(userId, 'following');
    const followingIds = followingRecords.map(r => {
      const u1 = r.userOneID.toString();
      const u2 = r.userTwoID.toString();
      return u1 === userId ? u2 : u1;
    });
    if (followingIds.length === 0) {
      return [];
    }

    // 2. Second-degree relations: followings of followings and followers of followings
    const followingObjectIds = followingIds.map(id => new Types.ObjectId(id));
    const rels = await this.relationModel.find({
      $and: [
        { $or: [ { userOneID: { $in: followingObjectIds } }, { userTwoID: { $in: followingObjectIds } } ] },
        { $or: [ { relation: { $regex: '^FOLLOW_' } }, { relation: { $regex: '_FOLLOW$' } } ] },
      ],
    }).exec();

    // 3. Extract candidates (the other side of each relation)
    const candidates = rels.map(r => {
      const u1 = r.userOneID.toString();
      const u2 = r.userTwoID.toString();
      // return the ID that isn't in followingIds
      return followingIds.includes(u1) ? u2 : u1;
    });
    const uniqueCandidates = Array.from(new Set(candidates));

    // 4. Exclude U, existing followings, and any block relations
    const blocking = await this.findByUserAndFilter(userId, 'blocking');
    const blockers = await this.findByUserAndFilter(userId, 'blockers');
    const blockedSet = new Set<string>([
      ...blocking.map(r => (r.userOneID.toString() === userId ? r.userTwoID : r.userOneID).toString()),
      ...blockers.map(r => (r.userOneID.toString() === userId ? r.userTwoID : r.userOneID).toString()),
    ]);

    const filtered = uniqueCandidates.filter(id =>
      id !== userId &&
      !followingIds.includes(id) &&
      !blockedSet.has(id)
    );

    // 5. Cap at `limit`
    return filtered.slice(0, limit);
  }
}
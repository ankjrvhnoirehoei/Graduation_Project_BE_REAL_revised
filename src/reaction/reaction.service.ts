import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Reaction, ReactionDocument } from './reaction.schema';

@Injectable()
export class ReactionService {
  constructor(
    @InjectModel(Reaction.name) private reactionModel: Model<ReactionDocument>,
  ) {}

  // Toggle like for a post. Returns true if liked, false if unliked.
  async toggleLike(userId: string, postId: string): Promise<{ liked: boolean }> {
    const filter = {
      userID: new Types.ObjectId(userId),
      targetType: 'post',
      targetID: new Types.ObjectId(postId),
    };

    const existing = await this.reactionModel.findOne(filter).exec();
    if (existing) {
      await this.reactionModel.deleteOne(filter).exec();
      return { liked: false };
    }

    try {
      await this.reactionModel.create({
        ...filter,
        reactionType: 'like',
      });
      return { liked: true };
    } catch (err) {
      // In case of race (duplicate key), treat as liked
      if (err.code === 11000) {
        return { liked: true };
      }
      throw err;
    }
  }
}
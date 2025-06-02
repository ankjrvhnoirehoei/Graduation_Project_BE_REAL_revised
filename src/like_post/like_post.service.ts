import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PostLike, PostLikeDocument } from './like_post.schema';

@Injectable()
export class PostLikeService {
  constructor(
    @InjectModel(PostLike.name)
    private postLikeModel: Model<PostLikeDocument>,
  ) {}

  async like(postId: string, userId: string): Promise<void> {
    const existing = await this.postLikeModel.findOne({ postId, userId });
    if (existing) {
      throw new ConflictException('User has already liked this post');
    }
    await this.postLikeModel.create({ postId, userId });
  }

  async unlike(postId: string, userId: string): Promise<void> {
    await this.postLikeModel.deleteOne({ postId, userId });
  }
}
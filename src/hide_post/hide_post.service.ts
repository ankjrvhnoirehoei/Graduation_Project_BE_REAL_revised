import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HiddenPost } from './hide_post.schema';

@Injectable()
export class UserHiddenPostService {
  constructor(
    @InjectModel(HiddenPost.name)
    private userHiddenPostModel: Model<HiddenPost>,
  ) {}

  async hidePost(userId: string, postId: string) {
    try {
      const created = await this.userHiddenPostModel.create({
        userId: new Types.ObjectId(userId),
        postId: new Types.ObjectId(postId),
      });
      return created;
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('Bài viết đã bị ẩn trước đó.');
      }
      throw error;
    }
  }
}

import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PostLikeDto } from './dto/post_likes.dto';
import { PostLike } from './post_likes.schema';

@Injectable()
export class PostLikeService {
  constructor(
    @InjectModel(PostLike.name) private postLikeModel: Model<PostLike>,
  ) {}

  async likeVideo(dto: PostLikeDto, userID: string) {
    const exists = await this.postLikeModel.findOne({
      userID: new Types.ObjectId(userID),
      videoId: new Types.ObjectId(dto.videoId),
    });

    if (exists) {
      throw new ConflictException('Video already liked');
    }

    const like = new this.postLikeModel({
      userID,
      videoId: dto.videoId,
    });

    return like.save();
  }

  async unlikeVideo(dto: PostLikeDto, userID: string) {
    const result = await this.postLikeModel.findOneAndDelete({
      userID: new Types.ObjectId(userID),
      videoId: new Types.ObjectId(dto.videoId),
    });

    if (!result) {
      throw new NotFoundException('Like not found');
    }

    return { message: 'Video unliked successfully' };
  }

  async getLikesCount(videoId: string): Promise<number> {
    return this.postLikeModel.countDocuments({ videoId });
  }

  // async isLikedByUser(videoId: string, userID: string): Promise<boolean> {
  //   const exists = await this.postLikeModel.exists({
  //     userID: new Types.ObjectId(userID),
  //     videoId: new Types.ObjectId(videoId),
  //   });
  //   return !!exists;
  // }
}

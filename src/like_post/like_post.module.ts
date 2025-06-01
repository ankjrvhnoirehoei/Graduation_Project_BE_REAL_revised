import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostLike, PostLikeSchema } from './like_post.schema';
import { PostLikeService } from './like_post.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PostLike.name, schema: PostLikeSchema },
    ]),
  ],
  providers: [PostLikeService],
  exports: [PostLikeService],
})
export class PostLikeModule {}
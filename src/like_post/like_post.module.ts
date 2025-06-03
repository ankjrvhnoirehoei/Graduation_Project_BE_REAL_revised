import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostLike, PostLikeSchema } from './like_post.schema';
import { PostLikeService } from './like_post.service';
import { PostLikeController } from './like_post.controller';
import { Post, PostSchema } from 'src/post/post.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PostLike.name, schema: PostLikeSchema },
      { name: Post.name, schema: PostSchema },
    ]),
  ],
  controllers: [PostLikeController],
  providers: [PostLikeService],
  exports: [PostLikeService],
})
export class PostLikeModule {}
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostLike, PostLikeSchema } from './post_likes.schema';
import { PostLikeController } from './post_likes.controller';
import { PostLikeService } from './post_likes.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PostLike.name, schema: PostLikeSchema },
    ]),
  ],
  controllers: [PostLikeController],
  providers: [PostLikeService],
})
export class PostLikeModule {}

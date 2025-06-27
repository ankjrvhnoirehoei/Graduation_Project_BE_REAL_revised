import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostLike, PostLikeSchema } from './like_post.schema';
import { PostLikeService } from './like_post.service';
import { PostLikeController } from './like_post.controller';
import { Post, PostSchema } from 'src/post/post.schema';
import { UserSchema } from 'src/user/user.schema';
import { RelationModule } from 'src/relation/relation.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PostLike.name, schema: PostLikeSchema },
      { name: Post.name, schema: PostSchema },
      { name: 'User', schema: UserSchema },
    ]),
    RelationModule,
    forwardRef(() => NotificationModule),
  ],
  controllers: [PostLikeController],
  providers: [PostLikeService],
  exports: [PostLikeService],
})
export class PostLikeModule {}
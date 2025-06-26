import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommentLike, CommentLikeSchema } from './like-comment.schema';
import { LikeCommentService } from './like-comment.service';
import { LikeCommentController } from './like-comment.controller';
import { Comment, CommentSchema } from 'src/comment/comment.schema';
import { User, UserSchema } from 'src/user/user.schema';
import { RelationModule } from 'src/relation/relation.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CommentLike.name, schema: CommentLikeSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: User.name, schema: UserSchema },
    ]),
    RelationModule,
    NotificationModule,
  ],
  controllers: [LikeCommentController],
  providers: [LikeCommentService],
  exports: [LikeCommentService],
})
export class LikeCommentModule {}
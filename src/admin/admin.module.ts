import { Module, forwardRef } from '@nestjs/common';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { DatabaseModule, UserSchema } from '@app/common';
import { UserModule } from 'src/user/user.module';
import { PostModule } from 'src/post/post.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { Post, PostSchema } from 'src/post/post.schema';
import { Story, StorySchema } from 'src/story/schema/story.schema';
import { RelationModule } from 'src/relation/relation.module';
import { Relation, RelationSchema } from 'src/relation/relation.schema';
import { User } from 'src/user/user.schema';
import { Comment, CommentSchema } from 'src/comment/comment.schema';
import { CommentModule } from 'src/comment/comment.module';
import { PostLike, PostLikeSchema } from 'src/like_post/like_post.schema';
import { PostLikeModule } from 'src/like_post/like_post.module';

@Module({
  imports: [
    DatabaseModule.forFeature([{ name: Post.name, schema: PostSchema }, { name: Story.name, schema: StorySchema }, { name: Relation.name, schema: RelationSchema }, { name: User.name, schema: UserSchema }, { name: Comment.name, schema: CommentSchema }, { name: PostLike.name, schema: PostLikeSchema },]),
    forwardRef(() => UserModule),
    forwardRef(() => PostModule),
    forwardRef(() => RelationModule),
    forwardRef(() => CommentModule),
    forwardRef(() => PostLikeModule),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}


import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '@app/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { Post, PostSchema } from './post.schema';
import { MediaModule } from 'src/media/media.module';
import { MusicModule } from 'src/music/music.module';
import { UserModule } from 'src/user/user.module';
import { PostLikeModule } from 'src/like_post/like_post.module';
import { CommentModule } from 'src/comment/comment.module';
import { Story, StorySchema } from 'src/story/schema/story.schema';
import { StoryModule } from 'src/story/story.module';
import { PostLike, PostLikeSchema } from 'src/like_post/like_post.schema';
import { Comment, CommentSchema } from 'src/comment/comment.schema';
import { RelationModule } from 'src/relation/relation.module';

@Module({
  imports: [
    DatabaseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Story.name, schema: StorySchema },
      { name: PostLike.name, schema: PostLikeSchema },
      { name: Comment.name, schema: CommentSchema }
    ]),
    MediaModule,
    MusicModule,
    forwardRef(() => UserModule), 
    CommentModule,
    StoryModule,
    forwardRef(() => PostLikeModule),
    RelationModule,
    MusicModule,
  ],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}

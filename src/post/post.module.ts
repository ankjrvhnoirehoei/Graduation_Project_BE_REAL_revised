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

@Module({
  imports: [
    DatabaseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
    MediaModule,
    MusicModule,
    forwardRef(() => UserModule), 
    PostLikeModule,
    CommentModule,
  ],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}

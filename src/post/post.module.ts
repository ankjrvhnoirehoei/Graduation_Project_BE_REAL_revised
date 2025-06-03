import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { Post, PostSchema } from './post.schema';
import { MediaModule } from 'src/media/media.module';
import { MusicModule } from 'src/music/music.module';

@Module({
  imports: [
    DatabaseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
    MediaModule,
    MusicModule,
  ],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}

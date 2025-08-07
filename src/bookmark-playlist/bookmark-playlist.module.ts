import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookmarkPlaylistService } from './bookmark-playlist.service';
import { BookmarkPlaylistController } from './bookmark-playlist.controller';
import {
  BookmarkPlaylist,
  BookmarkPlaylistSchema,
} from './bookmark-playlist.schema';
import { BookmarkItemModule } from 'src/bookmark-item/bookmark-item.module';
import { MusicModule } from 'src/music/music.module';
import { MediaModule } from 'src/media/media.module';
import { Post, PostSchema } from 'src/post/post.schema';
import { PostModule } from 'src/post/post.module';
import { CommonUtilsModule } from 'src/admin/helpers/helpers.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BookmarkPlaylist.name, schema: BookmarkPlaylistSchema },
      { name: Post.name, schema: PostSchema },
    ]),
    forwardRef(() => BookmarkItemModule),
    forwardRef(() => PostModule),
    CommonUtilsModule,
    MusicModule,
    MediaModule,
  ],
  providers: [BookmarkPlaylistService],
  controllers: [BookmarkPlaylistController],
  exports: [
    BookmarkPlaylistService,
    MongooseModule.forFeature([
      { name: BookmarkPlaylist.name, schema: BookmarkPlaylistSchema },
    ]), // Export the model
  ],
})
export class BookmarkPlaylistModule {}
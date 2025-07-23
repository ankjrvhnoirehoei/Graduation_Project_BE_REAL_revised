import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookmarkItemService } from './bookmark-item.service';
import { BookmarkItemController } from './bookmark-item.controller';
import { BookmarkItem, BookmarkItemSchema } from './bookmark-item.schema';
import {
  BookmarkPlaylist,
  BookmarkPlaylistSchema,
} from 'src/bookmark-playlist/bookmark-playlist.schema';
import { BookmarkPlaylistModule } from 'src/bookmark-playlist/bookmark-playlist.module';
import { PostModule } from 'src/post/post.module';
import { MusicModule } from 'src/music/music.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BookmarkItem.name, schema: BookmarkItemSchema },
      { name: BookmarkPlaylist.name, schema: BookmarkPlaylistSchema },
    ]),
    forwardRef(() => PostModule),
    forwardRef(() => BookmarkPlaylistModule),
    forwardRef(() => MusicModule),
  ],
  providers: [BookmarkItemService],
  controllers: [BookmarkItemController],
  exports: [
    BookmarkItemService,
    MongooseModule.forFeature([
      { name: BookmarkItem.name, schema: BookmarkItemSchema },
    ]),
  ],
})
export class BookmarkItemModule {}
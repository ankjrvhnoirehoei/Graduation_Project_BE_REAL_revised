import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookmarkItemService } from './bookmark-item.service';
import { BookmarkItemController } from './bookmark-item.controller';
import { BookmarkItem, BookmarkItemSchema } from './bookmark-item.schema';
import {
  BookmarkPlaylist,
  BookmarkPlaylistSchema,
} from 'src/bookmark-playlist/bookmark-playlist.schema';
import { BookmarkPlaylistService } from 'src/bookmark-playlist/bookmark-playlist.service';
import { PostModule } from 'src/post/post.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BookmarkItem.name, schema: BookmarkItemSchema },
      { name: BookmarkPlaylist.name, schema: BookmarkPlaylistSchema },
    ]),
    PostModule,
  ],
  providers: [BookmarkItemService, BookmarkPlaylistService],
  controllers: [BookmarkItemController],
  exports: [BookmarkItemService],
})
export class BookmarkItemModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookmarkPlaylistService } from './bookmark-playlist.service';
import { BookmarkPlaylistController } from './bookmark-playlist.controller';
import {
  BookmarkPlaylist,
  BookmarkPlaylistSchema,
} from './bookmark-playlist.schema';
import { BookmarkItemModule } from 'src/bookmark-item/bookmark-item.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BookmarkPlaylist.name, schema: BookmarkPlaylistSchema },
    ]),
    BookmarkItemModule, 
  ],
  providers: [BookmarkPlaylistService],
  controllers: [BookmarkPlaylistController],
  exports: [BookmarkPlaylistService],
})
export class BookmarkPlaylistModule {}

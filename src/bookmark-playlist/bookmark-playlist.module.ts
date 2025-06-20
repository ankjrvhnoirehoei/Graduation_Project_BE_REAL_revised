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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BookmarkPlaylist.name, schema: BookmarkPlaylistSchema },
    ]),
    forwardRef(() => BookmarkItemModule),
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
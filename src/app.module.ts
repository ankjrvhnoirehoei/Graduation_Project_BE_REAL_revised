import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule, LoggerModule, LoggingInterceptor } from '@app/common';
import { PostModule } from './post/post.module';
import { MediaModule } from './media/media.module';
import { UserModule } from './user/user.module';
import { CommentModule } from './comment/comment.module';
import { MusicModule } from './music/music.module';
import { RelationModule } from './relation/relation.module';
import { ReactionModule } from './reaction/reaction.module';
import { StoryModule } from './story/story.module';
import { PostLikeModule } from './like_post/like_post.module';
import { UserHiddenPostModule } from './hide_post/hide_post.module';
import { BookmarkPlaylistModule } from './bookmark-playlist/bookmark-playlist.module';
import { BookmarkItemModule } from './bookmark-item/bookmark-item.module';
import { NotificateModule } from './notificate/notificate.module';
import { StreamModule } from './streamM3U8/stream.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    LoggerModule,
    UserModule,
    PostModule,
    MediaModule,
    CommentModule,
    MusicModule,
    RelationModule,
    ReactionModule,
    StoryModule,
    PostLikeModule,
    UserHiddenPostModule,
    BookmarkPlaylistModule,
    BookmarkItemModule,
    NotificateModule,
    StreamModule,
  ],
  // providers: [
  //   {
  //     provide: APP_INTERCEPTOR,
  //     useClass: LoggingInterceptor,
  //   },
  // ],
})
export class AppModule {}

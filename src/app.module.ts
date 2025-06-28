import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule, LoggerModule, LoggingInterceptor } from '@app/common';
import { PostModule } from './post/post.module';
import { MediaModule } from './media/media.module';
import { UserModule } from './user/user.module';
import { CommentModule } from './comment/comment.module';
import { MusicModule } from './music/music.module';
import { RelationModule } from './relation/relation.module';
import { StoryModule } from './story/story.module';
import { PostLikeModule } from './like_post/like_post.module';
import { UserHiddenPostModule } from './hide_post/hide_post.module';
import { BookmarkPlaylistModule } from './bookmark-playlist/bookmark-playlist.module';
import { BookmarkItemModule } from './bookmark-item/bookmark-item.module';
import { StreamModule } from './streamM3U8/stream.module';
import { JwtModule } from '@nestjs/jwt';
import { R2UploadModule } from './r2/r2.module';
import { RoomModule } from './room/room.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MessageModule } from './message/message.module';
import { LikeCommentModule } from './like-comment/like-comment.module';
import { NotificationModule } from './notification/notification.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is not defined in environment variables');
        }
        return {
          secret,
          signOptions: { expiresIn: '5m' },
        };
      },
      inject: [ConfigService],
    }),
    DatabaseModule,
    LoggerModule,
    UserModule,
    PostModule,
    MediaModule,
    CommentModule,
    MusicModule,
    RelationModule,
    StoryModule,
    PostLikeModule,
    UserHiddenPostModule,
    BookmarkPlaylistModule,
    BookmarkItemModule,
    StreamModule,
    R2UploadModule,
    RoomModule,
    LikeCommentModule,
    MessageModule,
    NotificationModule,
    AdminModule,
  ],
  // providers: [
  //   {
  //     provide: APP_INTERCEPTOR,
  //     useClass: LoggingInterceptor,
  //   },
  // ],
})
export class AppModule {}

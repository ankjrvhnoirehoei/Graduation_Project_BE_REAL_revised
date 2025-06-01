import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule, LoggerModule, LoggingInterceptor } from '@app/common';
import { PostModule } from './post/post.module';
import { MediaModule } from './media/media.module';
import { UserModule } from './user/user.module';
import { CommentModule } from './comment/comment.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MusicModule } from './music/music.module';
import { RelationModule } from './relation/relation.module';
import { ReactionModule } from './reaction/reaction.module';
import { StoryModule } from './story/story.module';

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
  ],
  // providers: [
  //   {
  //     provide: APP_INTERCEPTOR,
  //     useClass: LoggingInterceptor,
  //   },
  // ],
})
export class AppModule {}

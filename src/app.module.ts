import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule, LoggerModule } from '@app/common';
import { PostModule } from './post/post.module';
import { MediaModule } from './media/media.module';
import { UserModule } from './user/user.module';

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
  ],
})
export class AppModule {}

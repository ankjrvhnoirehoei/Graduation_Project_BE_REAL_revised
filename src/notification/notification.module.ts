import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { Notification, NotificationSchema } from './notification.schema';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from '../gateway/notification.gateway';
import { PostLikeModule } from 'src/like_post/like_post.module';
import { UserModule } from 'src/user/user.module';
import { User, UserSchema } from 'src/user/user.schema';
import { Media, MediaSchema } from 'src/media/media.schema';
import { MediaModule } from 'src/media/media.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }, { name: User.name, schema: UserSchema }, { name: Media.name, schema: MediaSchema }]),
    JwtModule,            
    forwardRef(() => PostLikeModule),
    forwardRef(() => UserModule),
    forwardRef(() => MediaModule),
  ],
  providers: [NotificationService, NotificationGateway],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}

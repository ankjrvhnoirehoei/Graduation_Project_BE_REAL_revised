import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationController } from './notificate.controller';
import { NotificationService } from './notificate.service';
import { NotificationRepository } from './notificate.repository';
import { Notification, NotificationSchema } from './schema/notificate.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationRepository],
  exports: [NotificationService],
})
export class NotificationModule {}
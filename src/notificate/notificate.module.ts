import { Module } from '@nestjs/common';
import { NotificateService } from './notificate.service';
import { NotificateController } from './notificate.controller';

@Module({
  controllers: [NotificateController],
  providers: [NotificateService],
})
export class NotificateModule {}

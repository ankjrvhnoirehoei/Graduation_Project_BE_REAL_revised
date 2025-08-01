import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from '../../../src/user/user.schema';
import { NotificationCronService } from './notification-cron.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
  ],
  providers: [NotificationCronService],
})
export class NotificationCronModule {}

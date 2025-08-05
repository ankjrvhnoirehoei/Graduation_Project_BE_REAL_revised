import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportUser, ReportUserSchema } from './report-user.schema';
import { ReportUserService } from './report-user.service';
import { ReportUserController } from './report-user.controller';
import { User, UserSchema } from 'src/user/user.schema';
import { UserModule } from 'src/user/user.module';
import { CommonUtilsModule } from 'src/admin/helpers/helpers.module';
import { AdminModule } from 'src/admin/admin.module';
import { NotificationModule } from 'src/notification/notification.module';
import { Notification, NotificationSchema } from 'src/notification/notification.schema';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReportUser.name, schema: ReportUserSchema },
      { name: User.name, schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
    UserModule,
    CommonUtilsModule,
    forwardRef(() => AdminModule),
    forwardRef(() => NotificationModule),
  ],
  providers: [ReportUserService],
  controllers: [ReportUserController],
  exports: [MongooseModule, ReportUserService],
})
export class ReportUserModule {}
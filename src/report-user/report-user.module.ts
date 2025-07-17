import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportUser, ReportUserSchema } from './report-user.schema';
import { ReportUserService } from './report-user.service';
import { ReportUserController } from './report-user.controller';
import { User, UserSchema } from 'src/user/user.schema';
import { UserModule } from 'src/user/user.module';
import { AdminModule } from 'src/admin/admin.module'; 

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReportUser.name, schema: ReportUserSchema },
      { name: User.name, schema: UserSchema },
    ]),
    UserModule,
    forwardRef(() => AdminModule),
  ],
  providers: [ReportUserService],
  controllers: [ReportUserController],
  exports: [MongooseModule, ReportUserService],
})
export class ReportUserModule {}
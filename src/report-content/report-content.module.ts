import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportContent, ReportContentSchema } from './report-content.schema';
import { ReportContentService } from './report-content.service';
import { ReportContentController } from './report-content.controller';
import { User, UserSchema } from 'src/user/user.schema';
import { UserModule } from 'src/user/user.module';
import { AdminModule } from 'src/admin/admin.module'; 
import { Post, PostSchema } from 'src/post/post.schema';
import { PostModule } from 'src/post/post.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReportContent.name, schema: ReportContentSchema },
      { name: User.name, schema: UserSchema },
      { name: Post.name, schema: PostSchema },
    ]),
    UserModule,
    forwardRef(() => AdminModule),
    forwardRef(() => PostModule),
  ],
  providers: [ReportContentService],
  controllers: [ReportContentController],
  exports: [MongooseModule, ReportContentService],
})
export class ReportContentModule {}
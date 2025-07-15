import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { AdminReportController } from './admin-report.controller';
import { ReportRepository } from './report.repository';
import { Report, ReportSchema } from './report.schema';
import { Post, PostSchema } from '../post/post.schema';
import { Story, StorySchema } from '../story/schema/story.schema';
import { Comment, CommentSchema } from '../comment/comment.schema';
import { PostModule } from '../post/post.module';
import { UserModule } from '../user/user.module';
import { StoryModule } from '../story/story.module';
import { CommentModule } from '../comment/comment.module';
import { AdminModule } from '../admin/admin.module';

@Module({
    imports: [
        DatabaseModule.forFeature([
            { name: Report.name, schema: ReportSchema },
            { name: Post.name, schema: PostSchema },
            { name: Story.name, schema: StorySchema },
            { name: Comment.name, schema: CommentSchema },
        ]),
        PostModule,
        UserModule,
        StoryModule,
        CommentModule,
        AdminModule,
    ],
    controllers: [ReportController, AdminReportController],
    providers: [ReportService, ReportRepository],
    exports: [ReportService],
})
export class ReportModule { }
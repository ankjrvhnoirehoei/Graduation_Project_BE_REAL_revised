import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { AdminReportController } from './admin-report.controller';
import { ReportRepository } from './report.repository';
import { Report, ReportSchema } from './report.schema';
import { Post, PostSchema } from '../post/post.schema';
import { PostModule } from '../post/post.module';
import { UserModule } from '../user/user.module';
import { AdminModule } from '../admin/admin.module';

@Module({
    imports: [
        DatabaseModule.forFeature([
            { name: Report.name, schema: ReportSchema },
            { name: Post.name, schema: PostSchema },
        ]),
        PostModule,
        UserModule,
        AdminModule,
    ],
    controllers: [ReportController, AdminReportController],
    providers: [ReportService, ReportRepository],
    exports: [ReportService],
})
export class ReportModule { }
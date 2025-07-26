import { Module } from '@nestjs/common';
import { ReportStoryService } from './report-story.service';
import { ReportStoryController } from './report-story.controller';
import { ReportStoryRepository } from './report-story.repository';
import { DatabaseModule } from '@app/common';
import { ReportStory, ReportStorySchema } from './schema/report-story.schema';

@Module({
  imports: [
    DatabaseModule.forFeature([
      { name: ReportStory.name, schema: ReportStorySchema },
    ]),
  ],
  controllers: [ReportStoryController],
  providers: [ReportStoryService, ReportStoryRepository],
  exports: [ReportStoryService, ReportStoryRepository],
})
export class ReportStoryModule {}
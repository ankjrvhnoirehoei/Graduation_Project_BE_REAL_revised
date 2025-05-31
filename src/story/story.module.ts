import { Module } from '@nestjs/common';
import { StoryService } from './story.service';
import { StoryController } from './story.controller';
import { StoryRepository } from './story.repository';
import { RelationModule } from 'src/relation/relation.module';
import { DatabaseModule } from '@app/common';
import { Story, StorySchema } from './schema/story.schema';

@Module({
  imports: [
    DatabaseModule.forFeature([
      {
        name: Story.name, schema: StorySchema
      }
    ]
  ),
    RelationModule,
  ],
  controllers: [StoryController],
  providers: [StoryRepository, StoryService],
})
export class StoryModule {}

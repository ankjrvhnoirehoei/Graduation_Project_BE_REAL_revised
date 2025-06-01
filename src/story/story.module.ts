import { Module } from '@nestjs/common';
import { StoryService } from './story.service';
import { StoryController } from './story.controller';
import { StoryRepository } from './story.repository';
import { DatabaseModule } from '@app/common';
import { Story, StorySchema } from './schema/story.schema';
import { AuthModule } from 'src/auth/auth.module';
import { RelationModule } from 'src/relation/relation.module';

@Module({
  imports: [
    DatabaseModule.forFeature([
      { name: Story.name, schema: StorySchema },
    ]),
    AuthModule,
    RelationModule,
    AuthModule,
  ],
  controllers: [StoryController],
  providers: [StoryService, StoryRepository],
  exports: [StoryService, StoryRepository],
})
export class StoryModule {}

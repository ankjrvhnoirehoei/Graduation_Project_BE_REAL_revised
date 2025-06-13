import { Module } from '@nestjs/common';
import { StoryService } from './story.service';
import { StoryController } from './story.controller';
import { StoryRepository } from './story.repository';
import { DatabaseModule } from '@app/common';
import { Story, StorySchema } from './schema/story.schema';
import { RelationModule } from 'src/relation/relation.module';
import { UserModule } from 'src/user/user.module';
import { MusicModule } from 'src/music/music.module';

@Module({
  imports: [
    DatabaseModule.forFeature([
      { name: Story.name, schema: StorySchema },
    ]),
    RelationModule,
    UserModule,
    MusicModule,
  ],
  controllers: [StoryController],
  providers: [StoryService, StoryRepository],
  exports: [StoryService, StoryRepository],
})
export class StoryModule {}

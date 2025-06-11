import { ApiProperty } from '@nestjs/swagger';
import { StoryType } from '../../../../../src/story/schema/story.schema';

export class StorySchema {
  @ApiProperty({ description: 'ID of the story' })
  _id: 'ID of the story';

  @ApiProperty({ description: 'ID of the story owner' })
  ownerId: String;

  @ApiProperty({ description: 'URL of the story media' })
  mediaUrl: String;

  @ApiProperty({ description: 'List of user IDs who viewed the story' })
  viewedByUsers: Array<String>;

  @ApiProperty({ description: 'List of user IDs who liked the story' })
  likedByUsers: Array<String>;

  @ApiProperty({ description: 'Type of the story' })
  type: StoryType;

  @ApiProperty({ description: 'Whether the story is archived' })
  isArchived: Boolean;

  @ApiProperty({ description: 'Name of the highlight collection (for highlights)' })
  collectionName?: String;

  @ApiProperty({ description: 'List of story IDs in the highlight (for highlights)' })
  storyId?: Array<String>;
}
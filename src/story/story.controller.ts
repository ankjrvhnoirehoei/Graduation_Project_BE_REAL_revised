import { Controller, Post, Body, Param, Get, ValidationPipe } from '@nestjs/common';
import { StoryService } from './story.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { CreateHighlightDto } from './dto/create-hightlight.dto';
import { RelationService } from 'src/relation/relation.service';

@Controller('stories')
export class StoryController {
  constructor(
    private readonly service: StoryService,
    private readonly relationService: RelationService,
  ) {}
  
  @Get(':userId')
  async getAllStories(
    @Param('userId') userId: string
  ) {
    return this.service.findAll(userId);
  }

  @Get('highlights/:userId')
  async getAllHighlights(
    @Param('userId') userId: string
  ) {
    return this.service.findAllHighlights(userId);
  }

  @Get('following/:userId')
  async getFollowingStories(
    @Param('userId') userId: string,
  ) {
    const following = await this.relationService
      .findByUserAndFilter(userId, 'following');

    // const followingIds = following.map((relation) => relation.followedUser);
    return following;
  }

  @Post('create')
  async CreateStory(
    @Body() createStoryDto: CreateStoryDto
  ) {
    return this.service.create(createStoryDto);
  };

  @Post('create-highlight')
  async CreateHighlight(
    @Body() hightlightDto: CreateHighlightDto
  ){
    return this.service.createHighlight(hightlightDto);
  }

}

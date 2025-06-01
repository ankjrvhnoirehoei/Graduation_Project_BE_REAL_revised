import { Controller, Get, Post, Body, Patch, Param, Delete, ValidationPipe, UseGuards, Request } from '@nestjs/common';
import { StoryService } from './story.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { CreateHighlightStoryDto } from './dto/create-highlight.dto';
import { JwtAuthGuard } from '@app/common';
import { GetStoriesByIdsDto } from './dto/get-stories.dto'

@Controller('stories')
@UseGuards(JwtAuthGuard)
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  @Post('by-ids')
  async findStoriesByIds(
    @Body() body: GetStoriesByIdsDto
  ) {
    return this.storyService.findStoryById(body.storyIds);
  }

  @Get('user/:userId')
  async getStoriesByUser(
    @Param('userId') userId: string
  ) {
    return this.storyService.findStoriesByUser(userId);
  }

  @Get('highlights/user/:userId')
  async findHighlights(
    @Param('userId') userId: string
  ) {
    return this.storyService.findHighlightsByUser(userId);
  }

  @Get('following')
  async getFollowingStories(
    @Request() req
  ) {
    const userId = (req.user as any)._id.toString();
    return await this.storyService.getStoryFollowing(userId);
  }

  // stories/create
  @Post('create')
  async createStory(
    @Body() storyDto: CreateStoryDto
  ){
    return this.storyService.createStory(storyDto);
  }

  @Post('create-highlight')
  async createHighlightStory(
    @Body() storyDto: CreateHighlightStoryDto
  ){
    return this.storyService.createHighlightStory(storyDto);
  }

  @Patch('seen')
  async seenStory(
    @Body() storyDto: UpdateStoryDto
  ) {
    return this.storyService.seenStory(storyDto);
  }
}
import { Controller, Get, Post, Body, Patch, UseGuards, Query, Param } from '@nestjs/common';
import { StoryService } from './story.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { CreateHighlightStoryDto } from './dto/create-highlight.dto';
import { GetStoriesByIdsDto } from './dto/get-stories.dto';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from'src/common/decorators/current-user.decorator';

@Controller('stories')
@UseGuards(JwtRefreshAuthGuard)
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  @Get('user')
  async getStoriesByUser(
    @CurrentUser('sub') userId: string,
  ) {
    return this.storyService.findStoriesByUser(userId);
  }

  @Get('highlights/user/:userId')
  async findHighlights(
    @Param('userId') userId: string,
  ) {
    return this.storyService.findHighlightsByUser(userId);
  }

  @Get('following')
  async getFollowingStories(
    @CurrentUser('sub') userId: string,
    @Query() query,
  ) {
      return await this.storyService.getStoryFollowing(userId, query.page);
  }

  @Post('by-ids')
  async findStoriesByIds(
    @Body() body: GetStoriesByIdsDto
  ) {
    return this.storyService.findStoryById(body.storyIds);
  }

  @Post('create')
  async createStory(
    @CurrentUser('sub') userId: string,
    @Body() storyDto: CreateStoryDto
  ){
    return this.storyService.createStory(userId, storyDto);
  }

  @Post('create-highlight')
  async createHighlightStory(
    @CurrentUser('sub') userId: string,
    @Body() storyDto: CreateHighlightStoryDto
  ){
    return this.storyService.createHighlightStory(userId, storyDto);
  }

  @Patch('seen')
  async seenStory(
    @CurrentUser('sub') userId: string,
    @Body() storyDto: UpdateStoryDto
  ) {
    return this.storyService.seenStory(userId, storyDto);
  }
}
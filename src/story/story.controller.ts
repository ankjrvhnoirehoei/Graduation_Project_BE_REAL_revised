import { Controller, Get, Post, Body, Patch, UseGuards, Query, Param, ValidationPipe } from '@nestjs/common';
import { StoryService } from './story.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { UpdateHighlightDto } from './dto/update-highlight.dto';
import { CreateHighlightStoryDto } from './dto/create-highlight.dto';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from'src/common/decorators/current-user.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '@app/common';

@ApiTags('stories')
@Controller('stories')
@UseGuards(JwtRefreshAuthGuard)
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  @Post()
  @ApiOperation({ summary: `Get a list of story's details by storyId` })
  @ApiResponse({
    status: 200,
    response: {
      _id: String,
      ownerId: String,
      mediaUrl: String,
      viewedByUsers: Array,
      likedByUsers: Array,
    },
    description: 'Success',
    isArray: true
  })
  async findAll( @Body('storyId') storyId: string[] ) {
    return this.storyService.findStoryById(storyId);
  }

  @Get('me')
  @ApiOperation({ summary: `Get all archived-stories & unArchived-stories by cur_user` })
  @ApiResponse({
    status: 201,
    response: {
      _id: String,
      ownerId: String,
      mediaUrl: String,
      viewedByUsers: Array,
      likedByUsers: Array,
    },
    description: 'Success',
    isArray: true
  })
  async findStoriesByUser(@CurrentUser('sub') userId: string,
) {
    return this.storyService.findStoriesByCurUser(userId);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: `Get all working-stories by userId` })
  @ApiResponse({
    status: 201,
    response: {
      _id: String,
      ownerId: String,
      mediaUrl: String,
      viewedByUsers: Array,
      likedByUsers: Array,
    },
    description: 'Success',
    isArray: true
  })
  async getStoriesByUser( @Param('userId') userId: string ) {
    console.log(userId)
    return this.storyService.findWorkingStoriesByUser(userId);
  }

  @Get('following') 
  @ApiOperation({ summary: `Get all working-stories of whom followed by current-user` })
  @ApiResponse({
    status: 201,
    response: {
      _id: String,
      handleName: String,
      profilePic: String,
      stories: Array
    },
    description: 'Success',
    isArray: true
  })
  async getFollowingStories(
    @CurrentUser('sub') userId: string,
    @Query() query,
  ) {
      return await this.storyService.getStoryFollowing(userId, query.page);
  }

  @Get('highlights/user/:userId')
  @ApiOperation({ summary: 'Get all Highlights collection by userId' })
  @ApiResponse({
    status: 201,
    response: {
      _id: String,
      mediaUrl: String,
      collectionName: String,
      storyId: Array,
    },
    description: 'Success',
    isArray: true
  })
  async findHighlights( @Param('userId') userId: string ) {
    return this.storyService.findHighlightsByUser(userId);
  }

  @Post('create')
  @ApiOperation({ summary: `Created story by currentUser` })
  @ApiResponse({
    status: 201,
    response: {
      _id: String,
      ownerId: String,
      mediaUrl: String,
    },
    description: 'Created Story Successful',
    isArray: true
  })
  async createStory(
    @CurrentUser('sub') userId: string,
    @Body(new ValidationPipe()) storyDto: CreateStoryDto
  ){
    return this.storyService.createStory(userId, storyDto);
  }

  @Post('create/highlight')
  @ApiOperation({ summary: `Created Highlight collection by currentUser` })
  @ApiResponse({
    status: 201,
    response: {
      _id: String,
      collectionName: String,
      stoies: Array,
    },
    description: 'Created Success',
  })
  async createHighlightStory(
    @CurrentUser('sub') userId: string,
    @Body(new ValidationPipe()) storyDto: CreateHighlightStoryDto
  ){
    return this.storyService.createHighlight(userId, storyDto);
  }

  @Patch('update/highlight')
  @ApiOperation({ summary: `Updated highlightStories by currentUser` })
  @ApiResponse({
    status: 201,
    response: {
      _id: String,
      CollectionName: String,
      stoies: Array,
    },
    description: 'Updated Success',
  })
  async updateHighlightStory(
    @CurrentUser('sub') userId: string,
    @Body(new ValidationPipe()) storyDto: UpdateHighlightDto
  ){
    return this.storyService.updatedHighlight(userId, storyDto);
  }

  @Patch('seen')
  @ApiOperation({ summary: `Seen story by currentUser` })
  @ApiResponse({
    status: 201,
    response: {
      _id: String,
      viewer: Array,
    },
    description: 'Seen Success',
  })
  async seenStory(
    @CurrentUser('sub') userId: string,
    @Body(new ValidationPipe()) storyDto: UpdateStoryDto
  ) {
    return this.storyService.seenStory(userId, storyDto);
  }

  @Patch('archive')
  @ApiOperation({ summary: `Archive story by currentUser` })
  @ApiResponse({
    status: 201,
    response: {
      _id: String,
    },
    description: 'Archived Success',
  })
  async archiveStory(
    @CurrentUser('sub') userId: string,
    @Body(new ValidationPipe()) storyDto: UpdateStoryDto
  ) {
    return this.storyService.archiveStory(userId, storyDto);
  }

  @Patch('like')
  @ApiOperation({ summary: `Like story by currentUser` })
  @ApiResponse({
    status: 201,
    response: {
      _id: String,
      likeByUser: Array,
    },
    description: 'Liked Success',
    isArray: true
  })
  async likedStory(
    @CurrentUser('sub') userId: string,
    @Body(new ValidationPipe()) storyDto: UpdateStoryDto
  ) {
    return this.storyService.likedStory(userId, storyDto);
  }
}


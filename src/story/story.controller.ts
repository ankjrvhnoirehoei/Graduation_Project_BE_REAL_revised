import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  UseGuards,
  Query,
  Param,
  ValidationPipe,
} from '@nestjs/common';
import { StoryService } from './story.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { UpdateHighlightDto } from './dto/update-highlight.dto';
import { CreateHighlightStoryDto } from './dto/create-highlight.dto';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('stories')
@Controller('stories')
@UseGuards(JwtRefreshAuthGuard)
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  @Post()
  @ApiOperation({ summary: `Get a list of story's details by storyId` })
  async findAll(
    @CurrentUser('sub') userId: string,
    @Body('storyId') storyId: string[],
  ) {
    return this.storyService.findStoryById(storyId, userId);
  }

  @Get('me')
  @ApiOperation({
    summary: `Get all archived-stories & unArchived-stories by cur_user`,
  })
  async findStoriesByUser(@CurrentUser('sub') userId: string) {
    return this.storyService.findStoriesByCurUser(userId);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: `Get all working-stories by userId` })
  async getStoriesByUser(@Param() param: any) {
    return this.storyService.findWorkingStoriesByUser(param.userId);
  }

  @Get('following')
  @ApiOperation({
    summary: `Get all working-stories of whom followed by current-user`,
  })
  async getFollowingStories(
    @CurrentUser('sub') userId: string,
    @Query() query,
  ) {
    return await this.storyService.getStoryFollowing(userId, query.page);
  }

  @Get('highlights/user/:userId')
  @ApiOperation({ summary: 'Get all Highlights collection by userId' })
  async findHighlights(@Param('userId') userId: string) {
    return this.storyService.findHighlightsByUser(userId);
  }

  @Post('create')
  @ApiOperation({ summary: `Created story by currentUser` })
  async createStory(
    @CurrentUser('sub') userId: string,
    @Body(new ValidationPipe()) storyDto: CreateStoryDto,
  ) {
    return this.storyService.createStory(userId, storyDto);
  }

  @Post('create/highlight')
  @ApiOperation({ summary: `Created Highlight collection by currentUser` })
  async createHighlightStory(
    @CurrentUser('sub') userId: string,
    @Body(new ValidationPipe()) storyDto: CreateHighlightStoryDto,
  ) {
    return this.storyService.createHighlight(userId, storyDto);
  }

  @Patch('update/highlight')
  @ApiOperation({ summary: `Updated highlightStories by currentUser` })
  async updateHighlightStory(
    @CurrentUser('sub') userId: string,
    @Body(new ValidationPipe()) storyDto: UpdateHighlightDto,
  ) {
    return this.storyService.updatedHighlight(userId, storyDto);
  }

  @Patch('seen')
  @ApiOperation({ summary: `Seen story by currentUser` })
  async seenStory(
    @CurrentUser('sub') userId: string,
    @Body(new ValidationPipe()) storyDto: UpdateStoryDto,
  ) {
    return this.storyService.seenStory(userId, storyDto);
  }

  @Patch('archive')
  @ApiOperation({ summary: `Archive story by currentUser` })
  async archiveStory(
    @CurrentUser('sub') userId: string,
    @Body(new ValidationPipe()) storyDto: UpdateStoryDto,
  ) {
    return this.storyService.archiveStory(userId, storyDto);
  }

  @Patch('like')
  @ApiOperation({ summary: `Like story by currentUser` })
  async likedStory(
    @CurrentUser('sub') userId: string,
    @Body(new ValidationPipe()) storyDto: UpdateStoryDto,
  ) {
    return this.storyService.likedStory(userId, storyDto);
  }

  @Patch('delete')
  @ApiOperation({ summary: `Delete story by currentUser` })
  async deleteStory(
    @CurrentUser('sub') userId: string,
    @Body(new ValidationPipe()) storyDto: UpdateStoryDto,
  ) {
    return this.storyService.deletedStory(userId, storyDto);
  }
}

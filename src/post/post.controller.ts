import {
  Controller,
  Post as HttpPost,
  Body,
  Get,
  Post,
  UseGuards,
  BadRequestException,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  Param,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostWithMediaDto } from 'src/post/dto/post-media.dto';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { SearchDto } from './dto/search.dto';
import { WeeklyPostsDto } from './dto/weekly-posts.dto';
import { UserService } from 'src/user/user.service';
import { LastTwoWeeksDto } from './dto/last-two-weeks.dto';
import { TopPostDto } from './dto/top-posts.dto';
import { Types } from 'mongoose';

@Controller('posts')
@UseGuards(JwtRefreshAuthGuard)
export class PostController {
  constructor(private readonly postService: PostService, private readonly userService: UserService,) {}

  @Post('with-media')
  async createPostWithMedia(
    @Body() postWithMediaDto: CreatePostWithMediaDto,
    @CurrentUser('sub') userId: string,
  ) {
    const mergedPostWithMediaDto: any = {
      ...postWithMediaDto,
      post: {
        ...postWithMediaDto.post,
        userID: userId,
      },
    };

    return this.postService.createPostWithMediaAndMusic(mergedPostWithMediaDto);
  }

  @Get('get-all-with-media')
  async getAllWithMedia(
    @CurrentUser('sub') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<{
    items: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      limit: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    return this.postService.findAllWithMedia(userId, page, limit);
  }


  @Get('get-all-reel-media')
  async getAllReelMedia(
    @CurrentUser('sub') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<{
    items: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      limit: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    return this.postService.findReelsWithMedia(userId, page, limit);
  }

  @Get('get-all-reel-with-music')
  async getAllReelWithMusic(
    @CurrentUser('sub') userId: string,
  ) {
    return this.postService.findReelsWithMusic(userId);
  }

  // Returns up to 50 posts and up to 50 reels for user
  @Get('user/all')
  async getUserContent(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: 'posts' | 'reels',
  ) {
    const pageNum = parseInt(page || '1') || 1;
    const limitNum = parseInt(limit || '20') || 20;

    // Validate pagination parameters
    if (pageNum < 1) {
      throw new BadRequestException('Page must be greater than 0');
    }
    if (limitNum < 1 || limitNum > 50) {
      throw new BadRequestException('Limit must be between 1 and 50');
    }

    if (type && !['posts', 'reels'].includes(type)) {
      throw new BadRequestException('Type must be either "posts" or "reels"');
    }

    const [postsResult, reelsResult] = await Promise.all([
      type === 'reels'
        ? null
        : this.postService.getUserPostsWithMedia(userId, pageNum, limitNum),
      type === 'posts'
        ? null
        : this.postService.getUserReelsWithMedia(userId, pageNum, limitNum),
    ]);

    const response: any = {
      message: 'User content retrieved successfully',
    };

    if (postsResult) {
      response.posts = {
        items: postsResult.items,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(postsResult.total / limitNum),
          totalCount: postsResult.total,
          limit: limitNum,
          hasNextPage: pageNum < Math.ceil(postsResult.total / limitNum),
          hasPrevPage: pageNum > 1,
        },
      };
    }

    if (reelsResult) {
      response.reels = {
        items: reelsResult.items,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(reelsResult.total / limitNum),
          totalCount: reelsResult.total,
          limit: limitNum,
          hasNextPage: pageNum < Math.ceil(reelsResult.total / limitNum),
          hasPrevPage: pageNum > 1,
        },
      };
    }

    return response;
  }

    /**
   * GET /posts/user/:targetUserId/all
   * Returns paginated posts and/or reels belonging to :targetUserId,
   * as viewed by the current user (so includes isFollow).
   */
  @Get('user/:targetUserId/all')
  async getOtherUserContent(
    @Param('targetUserId') targetUserId: string,
    @CurrentUser('sub') viewerId:        string,
    @Query('page')      page?:           string,
    @Query('limit')     limit?:          string,
    @Query('type')      type?:           'posts' | 'reels',
  ) {
    const pageNum  = parseInt(page  || '1',  10) || 1;
    const limitNum = parseInt(limit || '20', 10) || 20;

    if (pageNum  < 1)               throw new BadRequestException('Page must be ≥ 1');
    if (limitNum < 1 || limitNum > 50)
      throw new BadRequestException('Limit must be between 1 and 50');
    if (type && !['posts','reels'].includes(type))
      throw new BadRequestException('Type must be "posts" or "reels"');

    return this.postService.getOtherUserContent(
      viewerId,
      targetUserId,
      pageNum,
      limitNum,
      type,
    );
  }


  @Post('search')
  async searchByCaption(
    @Body() { keyword }: SearchDto,
    @CurrentUser('sub') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const trimmed = keyword?.trim();
    if (!trimmed) {
      throw new BadRequestException('Keyword must not be empty');
    }

    return this.postService.searchByCaptionPaginated(
      userId,
      trimmed,
      page,
      limit,
    );
  }

  @Get('tags')
  async getRecentTags(@CurrentUser('sub') userId: string) {
    const tags = await this.postService.getRecentTags(userId);
    return { tags };
  }

  @Get('reels/:userId')
  async getReelsByUser(
    @Param('userId') userId: string,
  ) {
    // basic 24‑hex check
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestException('Invalid user ID.');
    }
    const data = await this.postService.getAllReelsForUser(userId);
    return {
      message: "Success",
      data
    };
  }

  /*======================== ADMIN-ONLY ========================*/

  @Get('admin/weekly')
  async getWeeklyStats(@CurrentUser('sub') userId: string): Promise<WeeklyPostsDto[]> {
    const user = await this.userService.findById(userId);
    if (!user || typeof user.role !== 'string') {
      throw new BadRequestException('User role not found.');
    }
    if (user.role !== 'admin') {
      throw new BadRequestException('Access denied: Admins only.');
    }
    return this.postService.getWeeklyPostCounts();
  }

  @Get('admin/last-two-weeks')
  async lastTwoWeeks(@CurrentUser('sub') userId: string): Promise<LastTwoWeeksDto[]> {
    const user = await this.userService.findById(userId);
    if (!user || typeof user.role !== 'string') {
      throw new BadRequestException('User role not found.');
    }
    if (user.role !== 'admin') {
      throw new BadRequestException('Access denied: Admins only.');
    }    
    return this.postService.getLastTwoWeeks();
  }  

  @Get('admin/top-liked')
  async getTopLiked(@CurrentUser('sub') userId: string): Promise<TopPostDto[]> {
    const user = await this.userService.findById(userId);
    if (!user || typeof user.role !== 'string') {
      throw new BadRequestException('User role not found.');
    }
    if (user.role !== 'admin') {
      throw new BadRequestException('Access denied: Admins only.');
    }    
    return this.postService.getTopLikedThisMonth(10);
  }  

  @Get('admin/stats/content-distribution')
  async getAllContents(
    @CurrentUser('sub') userId: string,
  ): Promise<{ type: string; value: number }[]> {
    const user = await this.userService.findById(userId);
    if (!user || typeof user.role !== 'string') {
      throw new BadRequestException('User role not found.');
    }
    if (user.role !== 'admin') {
      throw new BadRequestException('Access denied: Admins only.');
    }

    return this.postService.getContentDistribution();
  }

  @Get('admin/yearly-stats')
  async getAdminStats(@CurrentUser('sub') userId: string,) {
    const user = await this.userService.findById(userId);
    if (!user || user.role !== 'admin') {
      throw new BadRequestException('Access denied: Admins only.');
    }
    return this.postService.getTwoYearStats();
  }  

  @Get('admin/last-six-months')
  async getLastSixMonthsStats(@CurrentUser('sub') userId: string) {
    const user = await this.userService.findById(userId);
    if (!user || user.role !== 'admin') {
      throw new BadRequestException('Access denied: Admins only.');
    }

    return this.postService.getLastSixMonthsStats();
  }

  @Get('admin/compare-last-6-months')
  async compareLastSixMonths(
    @CurrentUser('sub') userId: string,
  ) {
    const user = await this.userService.findById(userId);
    if (!user || user.role !== 'admin') {
      throw new BadRequestException('Access denied: Admins only.');
    }
    return this.postService.compareLastSixMonthsPosts();
  }  

  @Get('admin/summary-posts')
  async getPostsSummary(@CurrentUser('sub') userId: string) {
    const user = await this.userService.findById(userId);
    if (!user || user.role !== 'admin') {
      throw new BadRequestException('Access denied: Admins only.');
    }
    return this.postService.getSixMonthPostsSummary();
  }  

  @Get(':id')
  async getPostById(
    @CurrentUser('sub') userId: string,
    @Param('id') postId: string,
  ): Promise<any> {
    // Validate ObjectId format
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID format');
    }

    return this.postService.findPostById(postId, userId);
  }
}

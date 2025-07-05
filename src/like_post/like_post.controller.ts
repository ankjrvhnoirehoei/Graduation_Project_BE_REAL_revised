import { Controller, Post, Param, UseGuards, Delete, Get, Query, BadRequestException } from '@nestjs/common';
import { PostLikeService } from './like_post.service';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { TimeRange, SortOrder } from './like_post.service';

@Controller('post-like')
export class PostLikeController {
  constructor(private readonly postLikeService: PostLikeService) {}

  @Post(':postId')
  @UseGuards(JwtRefreshAuthGuard)
  async likePost(@Param('postId') postId: string, @CurrentUser('sub') userId: string,) {
    await this.postLikeService.like(postId, userId);
    return { message: 'Liked successfully' };
  }

  @Delete(':postId')
  @UseGuards(JwtRefreshAuthGuard)
  async unlikePost(@Param('postId') postId: string, @CurrentUser('sub') userId: string,) {
    await this.postLikeService.unlike(postId, userId);
    return { message: 'Unliked successfully' };
  }

  /**
   * # Get first page (default 20 posts)
    GET /post-like/liked-posts

    # Get first page with custom limit
    GET /post-like/liked-posts?limit=10

    # Get specific page
    GET /post-like/liked-posts?page=2&limit=15

    # Get third page with 5 posts
    GET /post-like/liked-posts?page=3&limit=5
   */
  @Get('liked-posts')
  @UseGuards(JwtRefreshAuthGuard)
  async getLikedPosts(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('timeRange') timeRange?: string,
    @Query('sortOrder') sortOrder?: string
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

    // Validate time range parameter
    let validTimeRange: TimeRange | undefined;
    if (timeRange) {
      const validTimeRanges = Object.values(TimeRange);
      if (!validTimeRanges.includes(timeRange as TimeRange)) {
        throw new BadRequestException(
          `Invalid time range. Must be one of: ${validTimeRanges.join(', ')}`
        );
      }
      validTimeRange = timeRange as TimeRange;
    }

    // Validate sort order parameter
    let validSortOrder: SortOrder = SortOrder.DESC; // Default to descending
    if (sortOrder) {
      const validSortOrders = Object.values(SortOrder);
      if (!validSortOrders.includes(sortOrder as SortOrder)) {
        throw new BadRequestException(
          `Invalid sort order. Must be one of: ${validSortOrders.join(', ')}`
        );
      }
      validSortOrder = sortOrder as SortOrder;
    }

    const result = await this.postLikeService.getLikedPosts(
      userId, 
      pageNum, 
      limitNum, 
      validTimeRange, 
      validSortOrder
    );
    
    return {
      message: 'Liked posts retrieved successfully',
      data: result.posts,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalCount: result.totalCount,
        limit: limitNum,
        hasNextPage: result.currentPage < result.totalPages,
        hasPrevPage: result.currentPage > 1
      }
    };
  }

  @Get('likers/:postId')
  @UseGuards(JwtRefreshAuthGuard)
  async getPostLikers(@Param('postId') postId: string, @CurrentUser('sub') currentUserId: string,) {
    const likers = await this.postLikeService.getPostLikers(postId, currentUserId);
    return {
      message: 'Post likers retrieved successfully',
      data: likers
    };
  }
}

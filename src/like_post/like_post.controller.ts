import { Controller, Post, Param, UseGuards, Delete, Get, Query, BadRequestException } from '@nestjs/common';
import { PostLikeService } from './like_post.service';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

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
    @Query('limit') limit?: string
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

    const result = await this.postLikeService.getLikedPosts(userId, pageNum, limitNum);
    
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
}

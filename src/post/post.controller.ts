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

@Controller('posts')
@UseGuards(JwtRefreshAuthGuard)
export class PostController {
  constructor(private readonly postService: PostService) {}

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
  async getAllWithMedia(@CurrentUser('sub') userId: string) {
    return this.postService.findAllWithMedia(userId);
  }

  @Get('get-all-reel-media')
  async getAllReelMedia(@CurrentUser('sub') userId: string) {
    return this.postService.findReelsWithMedia(userId);
  }

  @Get('get-all-reel-with-music')
  async getAllReelWithMusic(
    @CurrentUser('sub') userId: string,
  ) {
    return this.postService.findReelsWithMusic(userId);
  }

  // // Returns up to 50 posts and up to 50 reels for user
  // @Get('user/all')
  // async getUserContent(
  //   @CurrentUser('sub') userId: string,
  //   @Query('page') page?: string,
  //   @Query('limit') limit?: string,
  //   @Query('type') type?: 'posts' | 'reels',
  // ) {
  //   const pageNum = parseInt(page || '1') || 1;
  //   const limitNum = parseInt(limit || '20') || 20;

  //   // Validate pagination parameters
  //   if (pageNum < 1) {
  //     throw new BadRequestException('Page must be greater than 0');
  //   }
  //   if (limitNum < 1 || limitNum > 50) {
  //     throw new BadRequestException('Limit must be between 1 and 50');
  //   }

  //   if (type && !['posts', 'reels'].includes(type)) {
  //     throw new BadRequestException('Type must be either "posts" or "reels"');
  //   }

  //   const [postsResult, reelsResult] = await Promise.all([
  //     type === 'reels'
  //       ? null
  //       : this.postService.getUserPostsWithMedia(userId, pageNum, limitNum),
  //     type === 'posts'
  //       ? null
  //       : this.postService.getUserReelsWithMedia(userId, pageNum, limitNum),
  //   ]);

  //   const response: any = {
  //     message: 'User content retrieved successfully',
  //   };

  //   if (postsResult) {
  //     response.posts = {
  //       items: postsResult.items,
  //       pagination: {
  //         currentPage: pageNum,
  //         totalPages: Math.ceil(postsResult.total / limitNum),
  //         totalCount: postsResult.total,
  //         limit: limitNum,
  //         hasNextPage: pageNum < Math.ceil(postsResult.total / limitNum),
  //         hasPrevPage: pageNum > 1,
  //       },
  //     };
  //   }

  //   if (reelsResult) {
  //     response.reels = {
  //       items: reelsResult.items,
  //       pagination: {
  //         currentPage: pageNum,
  //         totalPages: Math.ceil(reelsResult.total / limitNum),
  //         totalCount: reelsResult.total,
  //         limit: limitNum,
  //         hasNextPage: pageNum < Math.ceil(reelsResult.total / limitNum),
  //         hasPrevPage: pageNum > 1,
  //       },
  //     };
  //   }

  //   return response;
  // }
  /** 1) GET /posts/user/all */
  @Get('user/all')
  async getUserContent(
    @CurrentUser('sub') userId: string,
    @Query('page',  new DefaultValuePipe('1'), ParseIntPipe) page:  number,
    @Query('limit', new DefaultValuePipe('20'), ParseIntPipe) limit: number,
    @Query('type')   type?: 'posts' | 'reels'
  ) {
    if (limit < 1 || limit > 50)
      throw new BadRequestException('Limit must be between 1 and 50');

    const filter: 'post' | 'reel' | undefined =
      type === 'posts' ? 'post' :
      type === 'reels' ? 'reel' :
      undefined;

    const { total, items } = await this.postService.getUserContent(
      userId, page, limit, filter
    );

    return {
      message: 'User content retrieved successfully',
      items,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalCount: total,
        limit,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    };
  }

  /** 2) GET /posts/user/:id/all */
  @Get('user/:id/all')
  async getOtherUserContent(
    @Param('id') targetUserId: string,
    @CurrentUser('sub') currentUserId: string,
    @Query('page',  new DefaultValuePipe('1'), ParseIntPipe) page:  number,
    @Query('limit', new DefaultValuePipe('20'), ParseIntPipe) limit: number,
    @Query('type')   type?: 'posts' | 'reels'
  ) {
    if (limit < 1 || limit > 50)
      throw new BadRequestException('Limit must be between 1 and 50');

    const filter: 'post' | 'reel' | undefined =
      type === 'posts' ? 'post' :
      type === 'reels' ? 'reel' :
      undefined;

    const { total, items } = await this.postService.getOtherUserContent(
      targetUserId, currentUserId, page, limit, filter
    );

    return {
      items,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalCount: total,
        limit,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    };
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
}

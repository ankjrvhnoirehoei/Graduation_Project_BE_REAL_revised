import {
  Controller,
  Post as HttpPost,
  Body,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostWithMediaDto } from 'src/post/dto/post-media.dto';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post('with-media')
  @UseGuards(JwtRefreshAuthGuard)
  async createPostWithMedia(
    @Body() postWithMediaDto: CreatePostWithMediaDto,
    @CurrentUser('sub') userId: string,
  ) {
    const mergedPostWithMediaDto: CreatePostWithMediaDto = {
      ...postWithMediaDto,
      post: {
        ...postWithMediaDto.post,
        userID: userId,
      },
    };

    return this.postService.createPostWithMediaAndMusic(mergedPostWithMediaDto);
  }
  
  @Get('get-all-with-media')
  async getAllWithMedia() {
    return this.postService.findAllWithMediaGuest();
  }

  @Get('get-all-reel-media')
  async getAllReelMedia() {
    return this.postService.findReelsWithMediaGuest();
  }

  // get all medias but for logged-in users
  @UseGuards(JwtRefreshAuthGuard)
  @Post('user/get-all-with-media')
  async getAllWithMediaForUser(@CurrentUser('sub') userId: string,) {
    return this.postService.findAllWithMedia(userId);
  }

  @UseGuards(JwtRefreshAuthGuard)
  @Post('user/get-all-reel-media')
  async getAllReelMediaForUser(@CurrentUser('sub') userId: string,) {
    return this.postService.findReelsWithMedia(userId);
  }

  
  // Returns up to 50 posts and up to 50 reels for user
  @UseGuards(JwtRefreshAuthGuard)
  @Get('user/all')
  async getUserContent(@CurrentUser('sub') userId: string,) {
    const [postsResult, reelsResult] = await Promise.all([
      this.postService.getUserPostsWithMedia(userId),
      this.postService.getUserReelsWithMedia(userId),
    ]);

    return {
      posts: {
        total: postsResult.total,
        items: postsResult.items,
      },
      reels: {
        total: reelsResult.total,
        items: reelsResult.items,
      },
    };
  }
}

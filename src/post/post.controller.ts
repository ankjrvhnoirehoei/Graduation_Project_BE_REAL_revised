import { Controller, Post as HttpPost, Body, Get, Post, UseGuards } from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostWithMediaDto } from 'src/post/dto/post-media.dto';
import { CurrentUser } from '@app/common';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post('with-media')
  @UseGuards(JwtRefreshAuthGuard)
  async createPostWithMedia(
    @Body() postWithMediaDto: CreatePostWithMediaDto,
    @CurrentUser() user: any,
  ) {
    postWithMediaDto.post.userID = user._id;
    return this.postService.createPostWithMediaAndMusic(postWithMediaDto);
  }

  @Get('get-all-with-media')
  async getAllWithMedia() {
    return this.postService.findAllWithMedia();
  }

  @Get('get-all-reel-media')
  async getAllReelMedia() {
    return this.postService.findReelsWithMedia();
  }
}

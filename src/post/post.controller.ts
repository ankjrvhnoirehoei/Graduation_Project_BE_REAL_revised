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
    return this.postService.findAllWithMedia();
  }

  @Get('get-all-reel-media')
  async getAllReelMedia() {
    return this.postService.findReelsWithMedia();
  }
}

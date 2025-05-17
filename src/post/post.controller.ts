import { Controller, Post as HttpPost, Body, Get, Post } from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreatePostWithMediaDto } from 'src/post/dto/post-media.dto';
import { CreateMediaDto } from 'src/media/dto/create-media.dto';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post('simple')
  async create(@Body() createPostDto: CreatePostDto) {
    return this.postService.create(createPostDto);
  }

  @Post('with-media')
  async createPostWithMedia(
    @Body() postWithMediaDto: { post: CreatePostDto; media: CreateMediaDto[] },
  ) {
    return this.postService.createPostWithMedia(postWithMediaDto);
  }

  //   @Get()
  //   async findAll() {
  //     return this.postService.findAll();
  //   }

  @Get('get-all-with-media')
  async getAllWithMedia() {
    return this.postService.findAllWithMedia();
  }
}

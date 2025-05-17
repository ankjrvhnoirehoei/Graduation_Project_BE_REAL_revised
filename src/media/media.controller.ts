import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { MediaService } from './media.service';
import { Media } from './media.schema';
import { CreateMediaDto } from './dto/create-media.dto';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  async create(@Body() createMediaDto: CreateMediaDto): Promise<Media> {
    return this.mediaService.create(createMediaDto);
  }

  @Get()
  async findAll(): Promise<Media[]> {
    return this.mediaService.findAll();
  }

  @Get('post/:postID')
  async findByPostId(@Param('postID') postID: string): Promise<Media[]> {
    return this.mediaService.findByPostId(postID);
  }
}
import { Controller, Post, Body, Get, Query, Delete } from '@nestjs/common';
import { MusicService } from './music.service';
import { MusicDto } from './dto/music.dto';

@Controller('music')
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  @Post("add")
  create(@Body() musicDto: MusicDto) {
    return this.musicService.create(musicDto);
  }

  @Get("find-all")
  findAll() {
    return this.musicService.findAll();
  }

  @Get('by-post')
  findByPost(@Query('postID') postID: string) {
    return this.musicService.findByPost(postID);
  }
}
import { Controller, Post, Body, Get, Query, Delete, UseGuards } from '@nestjs/common';
import { MusicService } from './music.service';
import { MusicDto } from './dto/music.dto';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('music')
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  @Post("add")
  create(@Body() musicDto: MusicDto) {
    return this.musicService.create(musicDto);
  }

  @Get('find-all')
  @UseGuards(JwtRefreshAuthGuard)
  async findAll(@CurrentUser('sub') userId: string) {
    return this.musicService.findAll(userId);
  }

  @Get('by-post')
  findByPost(@Query('postID') postID: string) {
    return this.musicService.findByPost(postID);
  }
}
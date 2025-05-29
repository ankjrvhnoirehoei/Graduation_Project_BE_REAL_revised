import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  Get,
  Param,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@app/common';
import { PostLikeService } from './post_likes.service';
import { PostLikeDto } from './dto/post_likes.dto';

@Controller('video-likes')
@UseGuards(JwtAuthGuard)
export class PostLikeController {
  constructor(private readonly PostLikeService: PostLikeService) {}

  @Post('like')
  async likeVideo(@Body() dto: PostLikeDto, @CurrentUser() user: any) {
    return this.PostLikeService.likeVideo(dto, user.userID);
  }

  @Delete('unlike')
  async unlikeVideo(@Body() dto: PostLikeDto, @CurrentUser() user: any) {
    return this.PostLikeService.unlikeVideo(dto, user.userID);
  }

  @Get('count/:videoId')
  async getLikesCount(@Param('videoId') videoId: string) {
    return this.PostLikeService.getLikesCount(videoId);
  }

  // @Get('is-liked/:videoId')
  // async isLiked(@Param('videoId') videoId: string, @CurrentUser() user: any) {
  //   return this.PostLikeService.isLikedByUser(videoId, user.userID);
  // }
}

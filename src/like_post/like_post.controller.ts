import { Controller, Post, Param, UseGuards, Delete } from '@nestjs/common';
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
}

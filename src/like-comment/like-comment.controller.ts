import { Controller, Post, Param, UseGuards, Get } from '@nestjs/common';
import { LikeCommentService } from './like-comment.service';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('comment-like')
@UseGuards(JwtRefreshAuthGuard)
export class LikeCommentController {
  constructor(private readonly likeCommentService: LikeCommentService) {}

  /**
   * POST /comment-like/:commentId
   * Toggles a like on the specified comment for the current user.
   */
  @Post(':commentId')
  async toggleLike(
    @Param('commentId') commentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    const result = await this.likeCommentService.toggleLike(commentId, userId);
    return {
      message: result.liked ? 'Thích bình luận thành công.' : 'Bỏ thích bình luận thành công.',
      liked: result.liked,
    };
  }

  /**
   * GET all likers for a comment
   */
  @Get('likers/:commentId')
  async getCommentLikers(
    @Param('commentId') commentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    const likers = await this.likeCommentService.getCommentLikers(commentId, userId);
    return { message: 'Người thích bình luận trả về thành công.', data: likers };
  }
}

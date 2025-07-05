import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentDto } from './dto/comment.dto';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get('post/:postID')
  @UseGuards(JwtRefreshAuthGuard)
  async getCommentsByPost(
    @Param('postID') postID: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.commentService.getCommentsByPost(postID, userId);
  }

  @Post('add')
  @UseGuards(JwtRefreshAuthGuard)
  async createComment(
    @Body() dto: CommentDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.commentService.createComment(dto, userId);
  }

  @Post(':commentId/like')
  @UseGuards(JwtRefreshAuthGuard)
  async likeComment(
    @Param('commentId') commentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.commentService.likeComment(commentId, userId);
  }

  @Post(':commentId/unlike')
  @UseGuards(JwtRefreshAuthGuard)
  async unlikeComment(
    @Param('commentId') commentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.commentService.unlikeComment(commentId, userId);
  }
}

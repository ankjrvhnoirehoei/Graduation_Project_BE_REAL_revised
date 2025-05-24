import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentDto } from './dto/comment.dto';

@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get('post/:postID')
  async getCommentsByPost(@Param('postID') postID: string) {
    return this.commentService.getCommentsByPost(postID);
  }

  @Post('add')
  async createComment(@Body() dto: CommentDto) {
    return this.commentService.createComment(dto);
  }

  @Patch(':id/like')
  async likeComment(
    @Param('id') commentId: string,
    @Body('userID') userId: string,
  ) {
    return this.commentService.likeComment(commentId, userId);
  }

  @Patch(':id/unlike')
  async unlikeComment(
    @Param('id') commentId: string,
    @Body('userID') userId: string,
  ) {
    return this.commentService.unlikeComment(commentId, userId);
  }
}

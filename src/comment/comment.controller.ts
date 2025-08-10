import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
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
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(parseInt(page ?? '1', 10), 1);
    const limitNum = Math.max(parseInt(limit ?? '20', 10), 1);

    const { comments, totalCount } = await this.commentService.getCommentsByPost(postID, userId, pageNum, limitNum);
    const totalPages = Math.max(Math.ceil(totalCount / limitNum), 1);

    return {
      message: 'Comments retrieved successfully',
      data: comments,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };
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

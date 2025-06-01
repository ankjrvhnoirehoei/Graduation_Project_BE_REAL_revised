import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentDto } from './dto/comment.dto';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get('post/:postID')
  async getCommentsByPost(@Param('postID') postID: string) {
    return this.commentService.getCommentsByPost(postID);
  }

  @Post('add')
  @UseGuards(JwtRefreshAuthGuard)
  async createComment(
    @Body() dto: CommentDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.commentService.createComment(dto, userId);
  }
}

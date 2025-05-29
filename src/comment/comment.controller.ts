import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentDto } from './dto/comment.dto';
import { CurrentUser } from '@app/common';
import { JwtAuthGuard } from 'src/auth/strategies/jwt-auth.guard';

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get('post/:postID')
  async getCommentsByPost(@Param('postID') postID: string) {
    return this.commentService.getCommentsByPost(postID);
  }

  @Post('add')
  async createComment(@Body() dto: CommentDto, @CurrentUser() user: any) {
    return this.commentService.createComment(dto, user._id);
  }

  @Patch(':id/like')
  async likeComment(@Param('id') commentId: string, @CurrentUser() user: any) {
    return this.commentService.likeComment(commentId, user._id);
  }

  @Patch(':id/unlike')
  async unlikeComment(
    @Param('id') commentId: string,
    @CurrentUser() user: any,
  ) {
    return this.commentService.unlikeComment(commentId, user._id);
  }
}

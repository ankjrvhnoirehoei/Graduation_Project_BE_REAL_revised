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
import { JwtRefreshAuthGuard } from 'src/auth/strategies/jwt-refresh.guard';

@Controller('comments')
@UseGuards(JwtRefreshAuthGuard)
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
}

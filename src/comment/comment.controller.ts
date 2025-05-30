import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentDto } from './dto/comment.dto';
import { CurrentUser } from '@app/common';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';

@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get('post/:postID')
  async getCommentsByPost(@Param('postID') postID: string) {
    return this.commentService.getCommentsByPost(postID);
  }

  @Post('add')
  @UseGuards(JwtRefreshAuthGuard)
  async createComment(@Body() dto: CommentDto, @CurrentUser() user: any) {
    return this.commentService.createComment(dto, user._id);
  }
}

import { Controller, Post, Param, Req, UseGuards } from '@nestjs/common';
import { UserHiddenPostService } from './hide_post.service';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('user-hidden-post')
export class UserHiddenPostController {
  constructor(private readonly userHiddenPostService: UserHiddenPostService) {}

  @Post('hide/:postId')
  @UseGuards(JwtRefreshAuthGuard)
  async hidePost(
    @Param('postId') postId: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.userHiddenPostService.hidePost(userId, postId);
    return { message: 'Bài viết đã được ẩn.' };
  }
}

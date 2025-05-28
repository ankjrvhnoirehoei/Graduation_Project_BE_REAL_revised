import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@app/common';
import { ReactionService } from './reaction.service';

class ToggleLikeDto {
  postId: string;
}

@Controller('reactions')
export class ReactionController {
  constructor(private readonly reactionService: ReactionService) {}

  @Post('posts/like')
  @UseGuards(JwtAuthGuard)
  async togglePostLike(
    @Req() req,
    @Body() dto: ToggleLikeDto,
  ): Promise<{ liked: boolean }> {
    const userId = req.user.id;
    const { postId } = dto;
    return this.reactionService.toggleLike(userId, postId);
  }
}
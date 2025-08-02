import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ChatBoxService } from './chat-box.service';
import { ChatBox } from './chat-box.schema';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('chat-box')
export class ChatBoxController {
  constructor(private readonly chatBoxService: ChatBoxService) {}

  @Get('/history')
  @UseGuards(JwtRefreshAuthGuard)
  async getHistory(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @CurrentUser('sub') userId: string,
  ): Promise<ChatBox[]> {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    return this.chatBoxService.getHistory(userId, pageNumber, limitNumber);
  }
}

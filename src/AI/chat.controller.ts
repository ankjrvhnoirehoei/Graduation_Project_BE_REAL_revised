import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtRefreshAuthGuard } from '../../src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from '../../src/common/decorators/current-user.decorator';
import { ChatBoxService } from '../../src/chat-box/chat-box.service';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatBoxService: ChatBoxService,
  ) {}

  @Post('ask')
  @UseGuards(JwtRefreshAuthGuard)
  async ask(
    @Body('prompt') prompt: string,
    @CurrentUser('sub') userId: string,
  ) {
    const answer = await this.chatService.ask(prompt);
    await this.chatBoxService.saveChat(userId, prompt, answer);
    return { answer };
  }
}

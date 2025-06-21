import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get(':roomId')
  async getRecentMessages(
    @Param('roomId') roomId: string,
    @Query('limit') limit: number = 20,
  ) {
    return this.messageService.getRecentMessages(roomId, limit);
  }

  @Delete('room/:roomId')
  async deleteMessagesByRoom(@Param('roomId') roomId: string) {
    return this.messageService.deleteMessagesByRoom(roomId);
  }

  @Delete(':messageId')
  @UseGuards(JwtRefreshAuthGuard)
  async deleteMessage(
    @Param('messageId') messageId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.messageService.deleteMessageById(messageId, userId);
  }
}

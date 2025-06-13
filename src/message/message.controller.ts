import { Controller, Get, Param, Query } from '@nestjs/common';
import { MessageService } from './message.service';

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
}
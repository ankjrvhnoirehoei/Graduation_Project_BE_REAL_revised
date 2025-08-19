import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatBoxModule } from 'src/chat-box/chat-box.module';
import { ChatGateway } from 'src/gateway/chat.gateway';
@Module({
  imports: [ChatBoxModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}

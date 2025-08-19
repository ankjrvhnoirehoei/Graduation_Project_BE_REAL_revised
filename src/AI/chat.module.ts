import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatBoxModule } from 'src/chat-box/chat-box.module';
import { ChatGateway } from 'src/gateway/chat.gateway';
import { MessageModule } from 'src/message/message.module';
import { UserModule } from 'src/user/user.module';
import { NotificationModule } from 'src/notification/notification.module';
import { RoomModule } from 'src/room/room.module';
@Module({
  imports: [
    ChatBoxModule,
    MessageModule,
    UserModule,
    NotificationModule,
    RoomModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}

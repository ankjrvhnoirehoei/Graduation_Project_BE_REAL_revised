import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageService } from './message.service';
import { ChatGateway } from 'src/gateway/chat.gateway';
import { Message, MessageSchema } from './message.schema';
import { MessageController } from './message.controller';
import { UserModule } from 'src/user/user.module';
import { NotificationModule } from 'src/notification/notification.module';
import { RoomModule } from 'src/room/room.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
    forwardRef(() => UserModule),
    forwardRef(() => NotificationModule),
    forwardRef(() => RoomModule),
  ],
  providers: [MessageService, ChatGateway],
  controllers: [MessageController],
  exports: [MessageService],
})
export class MessageModule {}

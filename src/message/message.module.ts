import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageService } from './message.service';
import { ChatGateway } from 'src/gateway/chat.gateway';
import { Message, MessageSchema } from './message.schema';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
    forwardRef(() => UserModule),
  ],
  providers: [MessageService, ChatGateway],
  exports: [MessageService],
})
export class MessageModule {}
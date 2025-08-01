import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatBox, ChatBoxSchema } from './chat-box.schema';
import { ChatBoxService } from './chat-box.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: ChatBox.name, schema: ChatBoxSchema }])],
  providers: [ChatBoxService],
  exports: [ChatBoxService],
})
export class ChatBoxModule {}
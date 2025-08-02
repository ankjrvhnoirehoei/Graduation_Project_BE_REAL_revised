import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatBox, ChatBoxSchema } from './chat-box.schema';
import { ChatBoxService } from './chat-box.service';
import { ChatBoxController } from './chat-box.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ChatBox.name, schema: ChatBoxSchema }]),
  ],
  controllers: [ChatBoxController],
  providers: [ChatBoxService],
  exports: [ChatBoxService],
})
export class ChatBoxModule {}

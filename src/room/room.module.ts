import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { Room, RoomSchema } from './room.schema';
import { MessageModule } from '../message/message.module';
import { Message, MessageSchema } from '../message/message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    forwardRef(() => MessageModule),
  ],
  controllers: [RoomController],
  providers: [RoomService],
})
export class RoomModule {}

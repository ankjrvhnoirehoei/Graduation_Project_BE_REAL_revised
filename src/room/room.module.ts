import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Room, RoomSchema }       from './room.schema';
import { Relation, RelationSchema } from '../relation/relation.schema';
import { UserModule }             from '../user/user.module';
import { RoomMemberModule }       from '../room-member/room-member.module';

import { RoomService }    from './room.service';
import { RoomController } from './room.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name,     schema: RoomSchema },
      { name: Relation.name, schema: RelationSchema },
    ]),
    forwardRef(() => UserModule),
    forwardRef(() => RoomMemberModule),
  ],
  providers: [RoomService],
  controllers: [RoomController],
  exports: [RoomService],
})
export class RoomModule {}

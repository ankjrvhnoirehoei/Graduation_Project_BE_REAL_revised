import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomMember, RoomMemberSchema } from './room-member.schema';
import { RoomMemberService } from './room-member.service';
import { RoomMemberController } from './room-member.controller';
import { RoomModule } from '../room/room.module'; 
import { RelationModule } from 'src/relation/relation.module';

@Module({
    imports: [
        MongooseModule.forFeature([
        { name: RoomMember.name, schema: RoomMemberSchema }
        ]),
        forwardRef(() => RoomModule), 
        RelationModule, 
    ],
    providers: [RoomMemberService],
    controllers: [RoomMemberController],
    exports: [RoomMemberService],
})
export class RoomMemberModule {}
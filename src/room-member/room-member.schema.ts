import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoomMemberDocument = RoomMember & Document;

@Schema({ timestamps: { createdAt: 'joined_at', updatedAt: false } })
export class RoomMember {
    @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
    room: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    user: Types.ObjectId;

    @Prop({ type: String, enum: ['admin', 'normal'], default: 'normal' })
    role: string;

    @Prop()
    is_notified?: Boolean;

    @Prop()
    nickname?: string;

    @Prop()
    banned_at?: Date;

    @Prop()
    left_at?: Date;

    @Prop()
    singleChat: Boolean;
    joined_at: Date;
}

export const RoomMemberSchema = SchemaFactory.createForClass(RoomMember);
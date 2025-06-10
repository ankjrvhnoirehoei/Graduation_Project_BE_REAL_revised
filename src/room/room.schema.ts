import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoomDocument = Room & Document<Types.ObjectId>;

@Schema({
timestamps: { createdAt: 'created_at', updatedAt: false }
})
export class Room {
@Prop({ type: String, enum: ['single', 'group'], required: true })
type: string;

@Prop({ type: String })
name?: string;

@Prop({ type: String })
theme?: string;

@Prop({ default: false })
is_archived: boolean;

@Prop({ type: Types.ObjectId, ref: 'User', required: true })
created_by: Types.ObjectId;

@Prop()
deleted_at?: Date;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
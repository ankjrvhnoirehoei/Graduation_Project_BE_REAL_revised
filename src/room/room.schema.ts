import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Room extends Document {
  @Prop({ required: false })
  name: string;

  @Prop({ required: true })
  type: string;

  @Prop()
  theme?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  created_by: Types.ObjectId;

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] })
  user_ids: mongoose.Types.ObjectId[];
}

export const RoomSchema = SchemaFactory.createForClass(Room);

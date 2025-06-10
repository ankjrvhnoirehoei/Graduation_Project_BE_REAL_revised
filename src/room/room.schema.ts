import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Room extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  type: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  create_by: Types.ObjectId;

  @Prop({ type: String })
  theme?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  user_ids: Types.ObjectId[];
}

export const RoomSchema = SchemaFactory.createForClass(Room);

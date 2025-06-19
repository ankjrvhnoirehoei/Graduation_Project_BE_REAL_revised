import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: String, default: '' })
  content: string;

  @Prop({
    type: {
      type: String,
      enum: ['image', 'video', 'audio', 'file', 'call'],
    },
    url: String,
  })
  media?: {
    type: 'image' | 'video' | 'audio' | 'file' | 'call';
    url: string;
  };
}

export const MessageSchema = SchemaFactory.createForClass(Message);

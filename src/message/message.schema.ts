import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false, timestamps: { createdAt: true, updatedAt: false } })
export class Reaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  content: string;
}
export const ReactionSchema = SchemaFactory.createForClass(Reaction);

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

  @Prop({ type: [ReactionSchema], default: [] })
  reactions?: Reaction[];
}

export const MessageSchema = SchemaFactory.createForClass(Message);

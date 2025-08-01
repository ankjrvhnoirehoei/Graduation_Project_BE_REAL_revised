import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatBoxDocument = ChatBox & Document;

@Schema({ timestamps: true })
export class ChatBox {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true })
  prompt: string;

  @Prop({ required: true })
  answer: string;
}

export const ChatBoxSchema = SchemaFactory.createForClass(ChatBox);
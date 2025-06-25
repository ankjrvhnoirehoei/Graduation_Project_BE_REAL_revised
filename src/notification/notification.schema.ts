import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  receiver: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ type: Object, default: {} })
  data: Record<string, any>;

  @Prop({ default: false })
  isRead: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

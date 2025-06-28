import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ _id: false })
class ReceiverInfo {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  isRead: boolean;
}

const ReceiverInfoSchema = SchemaFactory.createForClass(ReceiverInfo);

@Schema({ timestamps: true })
export class Notification {
  @Prop({
    type: [ReceiverInfoSchema],
    required: true,
    default: [],
  })
  receiver: ReceiverInfo[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ type: Object, default: {} })
  data: Record<string, any>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

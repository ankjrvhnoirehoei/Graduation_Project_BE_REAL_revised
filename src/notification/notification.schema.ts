import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipient: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post', required: false })
  postId?: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  actors?: Types.ObjectId[];

  @Prop({ type: [{ type: String }] })
  subjects?: string[];

  @Prop({ type: String, required: true, enum: ['new_post', 'post_like', 'comment'] })
  type: string;
  
  @Prop({ type: String })
  caption: string;

  @Prop({ type: String })
  image: string;

  @Prop({ default: false })
  isRead: boolean;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

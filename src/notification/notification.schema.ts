import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  recipients: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Post', required: false })
  postId?: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  actors?: Types.ObjectId[];

  @Prop({ type: [{ type: String }] })
  subjects?: string[];

  @Prop({ type: String, required: true, enum: ['new_post', 'post_like', 'comment', 'reply', 'comment_like', 'new_story', 'story_like', 'follow_request', 'follow'] })
  type: string;
  
  @Prop({ type: String })
  caption: string;

  @Prop({ type: String })
  image: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  readBy: Types.ObjectId[];

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

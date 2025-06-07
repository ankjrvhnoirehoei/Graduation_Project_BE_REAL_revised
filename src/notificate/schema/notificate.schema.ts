import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';
import { AbstractDocument } from '@app/common';
import { User } from 'src/user/user.schema';
import { Comment } from 'src/comment/comment.schema';
import { Post } from 'src/post/post.schema';

export type NotificationType = 'POST_LIKE'|'COMMENT_LIKE'|'NEW_COMMENT'| 'NEW_MESSAGE'

@Schema({ versionKey: false, timestamps: true })
export class Notification extends AbstractDocument {
  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  user_id: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  trigger_user_id: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ 
    type: String, 
    required: true 
  })
  type: NotificationType;

  @Prop({ default: false })
  is_read: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: Post.name, required: false })
  post_id?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Comment.name, required: false })
  comment_id?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  created_at: Date;

  @Prop({ type: Date, default: Date.now })
  updated_at: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
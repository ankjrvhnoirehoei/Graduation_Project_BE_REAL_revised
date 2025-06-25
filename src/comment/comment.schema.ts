import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
export type CommentDocument = Comment & Document;
@Schema({ timestamps: true })
export class Comment extends Document {
  @Prop({ required: true, ref: 'User' })
  userID: Types.ObjectId;

  @Prop({ required: true, ref: 'Post' })
  postID: Types.ObjectId;

  @Prop({ ref: 'Comment' })
  parentID?: Types.ObjectId;

  @Prop({ required: true })
  content?: string;

  @Prop()
  mediaUrl?: string;

  @Prop()
  isDeleted: boolean;

  @Prop({ type: [Types.ObjectId], default: [] })
  likedBy?: Types.ObjectId[];;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Comment extends Document {
  @Prop({ required: true })
  userID: Types.ObjectId;

  @Prop({ required: true })
  postID: Types.ObjectId;

  @Prop()
  parentID?: Types.ObjectId;

  @Prop({ required: true })
  content?: string;

  @Prop()
  mediaUrl?: string;

  @Prop()
  isDeleted: boolean;

  @Prop({ type: [String], default: [] })
  likedBy: string[];
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

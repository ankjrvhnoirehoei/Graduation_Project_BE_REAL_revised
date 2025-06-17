import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';

export type CommentLikeDocument = CommentLike & Document;

@Schema({ timestamps: true })
export class CommentLike {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Comment', required: true })
  commentId: string;
}

export const CommentLikeSchema = SchemaFactory.createForClass(CommentLike);

// Ensure one like per user per comment
CommentLikeSchema.index({ userId: 1, commentId: 1 }, { unique: true });
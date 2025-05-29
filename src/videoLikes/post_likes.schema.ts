import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class PostLike extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
  videoId: Types.ObjectId;
}

export const PostLikeSchema = SchemaFactory.createForClass(PostLike);

PostLikeSchema.index({ userId: 1, postId: 1 }, { unique: true });
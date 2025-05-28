import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class VideoLike extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Video', required: true })
  videoId: Types.ObjectId;
}

export const VideoLikeSchema = SchemaFactory.createForClass(VideoLike);

VideoLikeSchema.index({ userId: 1, videoId: 1 }, { unique: true });
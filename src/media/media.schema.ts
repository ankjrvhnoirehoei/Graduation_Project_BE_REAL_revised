import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MediaDocument = Media & Document;

@Schema()
export class Media {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
  postID: Types.ObjectId;

  @Prop()
  imageUrl?: string;

  @Prop()
  videoUrl?: string;
}

export const MediaSchema = SchemaFactory.createForClass(Media);

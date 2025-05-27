import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Music extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
  postID: Types.ObjectId;

  @Prop({ required: true })
  song: string;

  @Prop({ required: true })
  link: string;

  @Prop({ required: true })
  author: string;

  @Prop({ required: true })
  coverImg: string;
}

export const MusicSchema = SchemaFactory.createForClass(Music);
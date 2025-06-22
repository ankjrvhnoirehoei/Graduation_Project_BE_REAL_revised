import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MediaDocument = Media & Document;

@Schema()
class Tag {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  handleName: string;

  @Prop({ type: Number, required: true })
  positionX: number;

  @Prop({ type: Number, required: true })
  positionY: number;
}

const TagSchema = SchemaFactory.createForClass(Tag);

@Schema()
export class Media {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
  postID: Types.ObjectId;

  @Prop()
  imageUrl?: string;

  @Prop()
  videoUrl?: string;

  @Prop({ type: [TagSchema], default: [] })
  tags?: Tag[];
}

export const MediaSchema = SchemaFactory.createForClass(Media);
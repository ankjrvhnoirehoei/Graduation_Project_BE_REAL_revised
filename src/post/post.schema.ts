	import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post {
  @Prop({ required: true })
  userID: string;

  @Prop({ required: true })
  type: string;

  @Prop()
  caption?: string;

  @Prop({ default: false })
  isFlagged?: boolean;

  @Prop({ default: false })
  nsfw?: boolean;

  @Prop({ required: true })
  isEnable: boolean;

  @Prop()
  location?: string;

  @Prop()
  isArchived?: string;

  @Prop({ required: true })
  viewCount: number;
}

export const PostSchema = SchemaFactory.createForClass(Post);
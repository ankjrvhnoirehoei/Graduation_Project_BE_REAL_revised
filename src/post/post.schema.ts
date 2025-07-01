import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MusicPostDto } from 'src/music/dto/music.dto';

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post {
  @Prop({ required: true })
  userID: Types.ObjectId;

  @Prop({ type: MusicPostDto, required: false })
  music?: {
    musicId: Types.ObjectId;
    timeStart: number;
    timeEnd: number;
  };

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

  @Prop({ default: 0 })
  viewCount?: number;

  @Prop({ default: 0 })
  share?: number;
}

export const PostSchema = SchemaFactory.createForClass(Post);

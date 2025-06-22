import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
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

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'User', required: true },
        handleName: { type: String, required: true },
        positionX: { type: Number, required: true },
        positionY: { type: Number, required: true },
        _id: false,
      },
    ],
  })
  tags?: {
    userId: Types.ObjectId;
    handleName: string;
    positionX: number;
    positionY: number;
  }[];
}

export const PostSchema = SchemaFactory.createForClass(Post);

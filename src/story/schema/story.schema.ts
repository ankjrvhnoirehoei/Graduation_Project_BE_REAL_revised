import { AbstractDocument } from "@app/common";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { Music } from "src/music/music.schema";
import { User } from "src/user/user.schema";

export enum StoryType {
  STORIES = 'stories',
  HIGHLIGHTS = 'highlights',
}

@Schema({ versionKey: false, timestamps: true })
export class Story extends AbstractDocument {
  @Prop({ ref: User.name, required: true })
  ownerId: Types.ObjectId;

  @Prop()
  type: StoryType;

  @Prop()
  mediaUrl: string;

  @Prop({ default: false })
  isArchived: boolean;

  @Prop({ type: [Types.ObjectId], default: [], ref: User.name })
  viewedByUsers: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], default: [], ref: User.name })
  likedByUsers: Types.ObjectId[];

  @Prop()
  collectionName: string;

  @Prop({ type: [Types.ObjectId], default: [], ref: Story.name })
  storyId: Types.ObjectId[];

  @Prop({
    type: {
      _id: { type: Types.ObjectId, ref: Music.name },
      link: { type: String },
      time_start: { type: Number, min: 0 },
      time_end: { type: Number, min: 0 },
    },
    default: {},
  })
  music: {
    _id: Types.ObjectId;
    link: string;
    time_start: number;
    time_end: number;
  };

  @Prop({
    type: {
      text: { type: String },
      x: { type: Number, min: 0 },
      y: { type: Number, min: 0 },
    },
    _id: false,
    default: {},
  })
  content: {
    text: string;
    x: number;
    y: number;
  };

  @Prop({ default: Date.now() })
  createdAt: Date;
}
export const StorySchema = SchemaFactory.createForClass(Story);

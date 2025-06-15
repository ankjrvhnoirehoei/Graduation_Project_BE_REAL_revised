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

  @Prop({ ref: Story.name })
  storyId: string[];

  @Prop()
  musicId: string;

  @Prop({ default: 50 })
  limitHighlight: 50;

  @Prop({ default: Date.now() })
  createdAt: Date;
}
export const StorySchema = SchemaFactory.createForClass(Story);

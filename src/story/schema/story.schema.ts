import { AbstractDocument } from '@app/common';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { User } from 'src/user/user.schema';

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

  @Prop()
  viewedByUsers: Types.ObjectId[];

  @Prop()
  likedByUsers: Types.ObjectId[];

  @Prop()
  collectionName: string;

  @Prop({ ref: Story.name })
  storyId: string[];

  @Prop({ default: 50 })
  limitHighlight: 50;
  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}
export const StorySchema = SchemaFactory.createForClass(Story);

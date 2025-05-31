import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { AbstractDocument } from "@app/common";
import { Types } from "mongoose";
import { User } from "src/user/user.schema";

@Schema({ timestamps: true })
export class Story extends AbstractDocument {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId: Types.ObjectId;

  @Prop()
  mediaUrl: string;

  @Prop()
  viewsCount: number;

  @Prop()
  isArchived: boolean;

  @Prop({ type: Types.ObjectId, ref: User.name})
  viewerId: Types.ObjectId[];

  @Prop()
  type: 'story' | 'highlight';

  @Prop()
  collectionName: string;

  @Prop()
  storyId: string[];
}
export const StorySchema = SchemaFactory.createForClass(Story);
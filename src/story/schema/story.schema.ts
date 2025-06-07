import { AbstractDocument } from "@app/common";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { User } from "src/user/user.schema";

@Schema({versionKey: false, timestamps: true})
export class Story extends AbstractDocument {
   @Prop({ref: User.name, required: true})
   ownerId: Types.ObjectId;

   @Prop()
   type: 'stories' | 'highlights';

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
}
export const StorySchema = SchemaFactory.createForClass(Story);
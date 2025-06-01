import { AbstractDocument } from "@app/common";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { User } from "src/user/user.schema";

@Schema({versionKey: false, timestamps: true})
export class Story extends AbstractDocument {
   @Prop({ref: User.name, required: true})
   userId: Types.ObjectId;

   @Prop()
   type: 'stories' | 'highlights';

   @Prop()
   mediaUrl: string;

   @Prop()
   viewsCount: number;

   @Prop({ default: false })
   isArchived: boolean;

   @Prop()
   viewerId: Types.ObjectId[];

   @Prop()
   collectionName: string;

   @Prop({ ref: Story.name })
   storyId: string[];
}
export const StorySchema = SchemaFactory.createForClass(Story);
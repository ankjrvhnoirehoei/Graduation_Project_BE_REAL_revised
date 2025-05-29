import { AbstractDocument } from "@app/common";
import { Prop, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { User } from "src/user/user.schema";

export class Relationship extends AbstractDocument {
  @Prop({ type: Types.ObjectId, ref: User.name , required: true })
  flwr: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name , required: true })
  flwing: Types.ObjectId;

  @Prop()
  caption?: string;

  @Prop({ default: false })
  isFlagged?: boolean;

  @Prop({ default: true })
  nsfw?: boolean;

  @Prop({default: new Date()})
  // used for both (Created and Updated)-date
  created_at?: Date;

  @Prop({ required: false })
  isEnable?: boolean; // for Highlight story

  @Prop({default: ''})
  location?: string;

  @Prop({ default: false })
  isArchived?: boolean; // for POST

  @Prop({default: 0})
  viewCount?: number;
}

export const PostSchema = SchemaFactory.createForClass(Relationship);
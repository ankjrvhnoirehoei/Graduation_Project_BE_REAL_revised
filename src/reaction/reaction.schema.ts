import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReactionDocument = Reaction & Document;

// further types in later versions
enum TargetType {
  POST = 'post',
}

enum ReactionType {
  LIKE = 'like',
}

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: false },
})
export class Reaction {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  userID: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(TargetType),
    required: true,
  })
  targetType: TargetType;

  @Prop({ type: Types.ObjectId, required: true })
  targetID: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ReactionType),
    required: true,
  })
  reactionType: ReactionType;
}

export const ReactionSchema = SchemaFactory.createForClass(Reaction);
ReactionSchema.index({ userID: 1, targetType: 1, targetID: 1 }, { unique: true });
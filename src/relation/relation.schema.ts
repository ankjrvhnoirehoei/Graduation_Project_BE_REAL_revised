import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RelationDocument = Relation & Document;

export enum RelationType {
  FOLLOW_NULL = 'FOLLOW_NULL',
  FOLLOW_FOLLOW = 'FOLLOW_FOLLOW',
  FOLLOW_BLOCK = 'FOLLOW_BLOCK',
  BLOCK_FOLLOW = 'BLOCK_FOLLOW',
  BLOCK_BLOCK = 'BLOCK_BLOCK',
  BLOCK_NULL = 'BLOCK_NULL',
  NULL_FOLLOW = 'NULL_FOLLOW',
  NULL_BLOCK = 'NULL_BLOCK',
}

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Relation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userOneID: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userTwoID: Types.ObjectId;

  @Prop({
    type: String,
    enum: RelationType,
    required: true,
  })
  relation: RelationType;
  created_at?: Date;
  updated_at?: Date;
}

export const RelationSchema = SchemaFactory.createForClass(Relation);
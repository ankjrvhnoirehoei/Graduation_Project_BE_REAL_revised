import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReportUserDocument = ReportUser & Document;

export enum ReportReason {
  HARASSMENT_AND_BULLYING = 'HARASSMENT_AND_BULLYING',
  HATE_SPEECH = 'HATE_SPEECH',
  IMPERSONATION_FAKE_ACCOUNTS = 'IMPERSONATION_FAKE_ACCOUNTS',
  GRAPHIC_CONTENT = 'GRAPHIC_CONTENT',
  THREATS_AND_VIOLENCE = 'THREATS_AND_VIOLENCE',
  SCAMS_AND_FRAUD = 'SCAMS_AND_FRAUD',
  SENSITIVE_PERSONAL_INFO = 'SENSITIVE_PERSONAL_INFO',
  SELF_HARM = 'SELF_HARM',
  OTHER = 'OTHER',
}

@Schema({ timestamps: true })
export class ReportUser {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reporterId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  targetId: Types.ObjectId;

  @Prop({ enum: ReportReason, required: true })
  reason: ReportReason;

  @Prop({ maxlength: 200 })
  description?: string;

  @Prop({ default: false })
  resolved: boolean;

  @Prop({ default: false })
  isDismissed: boolean;
}

export const ReportUserSchema = SchemaFactory.createForClass(ReportUser);
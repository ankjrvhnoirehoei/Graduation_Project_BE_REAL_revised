import { AbstractDocument } from "@app/common";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types, Document } from "mongoose";
import { User } from "src/user/user.schema";
import { Story } from "src/story/schema/story.schema";

export type ReportStoryDocument = ReportStory & Document;

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

export enum ReportStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed'
}

export enum ReportPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

@Schema({ 
  timestamps: true,
  collection: 'report_stories'
})
export class ReportStory extends AbstractDocument {
  @Prop({ 
    type: Types.ObjectId, 
    ref: User.name, 
    required: true,
    index: true
  })
  reporterId: Types.ObjectId;

  @Prop({ 
    type: Types.ObjectId, 
    ref: Story.name, 
    required: true,
    index: true
  })
  targetId: Types.ObjectId;

  @Prop({ 
    enum: Object.values(ReportReason),
    required: true,
    index: true
  })
  reason: ReportReason;

  @Prop({ 
    type: String,
    maxlength: 200,
    trim: true
  })
  description?: string;

  @Prop({ 
    type: String,
    enum: Object.values(ReportStatus),
    default: ReportStatus.PENDING,
    index: true
  })
  status: ReportStatus;

  @Prop({ 
    type: Types.ObjectId, 
    ref: User.name 
  })
  reviewerId?: Types.ObjectId;

  @Prop({ 
    type: String,
    maxlength: 1000,
    trim: true
  })
  reviewNote?: string;

  @Prop({ 
    type: Date 
  })
  reviewedAt?: Date;

  @Prop({ 
    type: String,
    enum: Object.values(ReportPriority),
    default: ReportPriority.MEDIUM,
    index: true
  })
  priority: ReportPriority;

  @Prop({
    type: Object,
    default: {}
  })
  metadata?: Record<string, any>;
}

export const ReportStorySchema = SchemaFactory.createForClass(ReportStory);

// Indexes
ReportStorySchema.index({ reporterId: 1, targetId: 1 });
ReportStorySchema.index({ status: 1, createdAt: -1 });
ReportStorySchema.index({ reason: 1, priority: 1 });
ReportStorySchema.index({ targetId: 1, status: 1 });

// Middleware
ReportStorySchema.pre('save', function(next) {
  if (this.isModified('status') && this.status !== ReportStatus.PENDING) {
    this.reviewedAt = new Date();
  }
  next();
});
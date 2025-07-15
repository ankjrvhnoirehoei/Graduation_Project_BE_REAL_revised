import { AbstractDocument } from '@app/common';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/user/user.schema';

export type ReportDocument = Report & Document;

export enum ReportTargetType {
    POST = 'post',
    STORY = 'story',
    USER = 'user',
    COMMENT = 'comment',
}

export enum ReportStatus {
    PENDING = 'pending',
    REVIEWED = 'reviewed',
    RESOLVED = 'resolved',
    DISMISSED = 'dismissed',
}

export enum ReportPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

export enum AdminAction {
    DISABLE = 'disable',
    DELETE = 'delete',
    WARNING = 'warning',
    NO_ACTION = 'no_action',
}

@Schema({ timestamps: true })
export class Report extends AbstractDocument {
    @Prop({ type: Types.ObjectId, ref: User.name, required: true })
    reporterId: Types.ObjectId;

    @Prop({ type: String, enum: ReportTargetType, required: true })
    targetType: ReportTargetType;

    @Prop({ type: Types.ObjectId, required: true })
    targetId: Types.ObjectId;

    @Prop({ required: true })
    reason: string;

    @Prop()
    description?: string;

    @Prop({ type: String, enum: ReportStatus, default: ReportStatus.PENDING })
    status: ReportStatus;

    @Prop({ type: String, enum: ReportPriority, default: ReportPriority.MEDIUM })
    priority: ReportPriority;

    @Prop({ type: Types.ObjectId, ref: User.name })
    adminId?: Types.ObjectId;

    @Prop({ type: String, enum: AdminAction })
    adminAction?: AdminAction;

    @Prop()
    adminNote?: string;

    @Prop()
    resolvedAt?: Date;

    @Prop({ default: Date.now })
    createdAt: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);
import { AbstractDocument } from '@app/common';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/user/user.schema';

export type ReportDocument = Report & Document;

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

export enum ReportReason {
    HARASSMENT_BULLYING = 'Bắt nạt hoặc liên hệ theo cách không mong muốn',
    SELF_HARM_SUICIDE = 'Tự tử, tự gây thương tích hoặc chứng rối loạn ăn uống',
    VIOLENCE_HATE = 'Bạo lực, thù ghét hoặc bóc lột',
    SALE_RESTRICTED_ITEMS = 'Bán hoặc quảng cáo mặt hàng bị hạn chế',
    NUDITY_SEXUAL_ACTIVITY = 'Ảnh khỏa thân hoặc hoạt động tình dục',
    SCAM_FRAUD = 'Lừa đảo, gian lận hoặc spam',
    FALSE_INFORMATION = 'Thông tin sai sự thật',
    INTELLECTUAL_PROPERTY = 'Quyền sở hữu trí tuệ',
}

export enum AdminAction {
    DISABLE = 'disable',
    DELETE = 'delete',
    WARNING = 'warning',
    NO_ACTION = 'no_action',
}

@Schema({ versionKey: false })
export class Report extends AbstractDocument {
    @Prop({ type: Types.ObjectId, ref: User.name, required: true })
    reporterId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, required: true })
    targetId: Types.ObjectId;

    @Prop({ type: String, enum: ReportReason, required: true })
    reason: ReportReason;

    @Prop()
    description?: string;

    @Prop({ type: String, enum: ReportStatus, default: ReportStatus.PENDING })
    status: ReportStatus;

    @Prop({ type: String, enum: ReportPriority, default: ReportPriority.LOW })
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
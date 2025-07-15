import { Types } from 'mongoose';
import { ReportStatus, ReportPriority, AdminAction, ReportReason } from '../report.schema';

export class ReportResponseDto {
    _id: Types.ObjectId;
    reporterId: Types.ObjectId;
    targetId: Types.ObjectId;
    reason: ReportReason;
    description?: string;
    status: ReportStatus;
    priority: ReportPriority;
    adminId?: Types.ObjectId;
    adminAction?: AdminAction;
    adminNote?: string;
    createdAt: Date;
    resolvedAt?: Date;

    // Populated fields
    reporter?: {
        _id: Types.ObjectId;
        username: string;
        handleName: string;
        profilePic?: string;
    };

    admin?: {
        _id: Types.ObjectId;
        username: string;
        handleName: string;
    };

    target?: {
        _id: Types.ObjectId;
        caption: string;
        type: string;
        isEnable: boolean;
        isFlagged: boolean;
    };
}

export class ReportStatsDto {
    totalReports: number;
    pendingReports: number;
    resolvedReports: number;
    dismissedReports: number;
    reportsByPriority: {
        low: number;
        medium: number;
        high: number;
        critical: number;
    };
}
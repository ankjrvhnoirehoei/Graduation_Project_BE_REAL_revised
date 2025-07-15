import { Types } from 'mongoose';
import { ReportTargetType, ReportStatus, ReportPriority, AdminAction } from '../report.schema';

export class ReportResponseDto {
    _id: Types.ObjectId;
    reporterId: Types.ObjectId;
    targetType: ReportTargetType;
    targetId: Types.ObjectId;
    reason: string;
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

    target?: any; // Will be populated based on targetType
}

export class ReportStatsDto {
    totalReports: number;
    pendingReports: number;
    resolvedReports: number;
    dismissedReports: number;
    reportsByType: {
        post: number;
        story: number;
        user: number;
        comment: number;
    };
    reportsByPriority: {
        low: number;
        medium: number;
        high: number;
        critical: number;
    };
}
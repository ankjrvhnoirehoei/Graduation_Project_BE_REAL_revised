export class ReportAnalyticsDto {
    totalReports: number;
    reportsThisWeek: number;
    reportsThisMonth: number;
    averageResolutionTime: number; // in hours

    statusBreakdown: {
        pending: number;
        reviewed: number;
        resolved: number;
        dismissed: number;
    };

    priorityBreakdown: {
        low: number;
        medium: number;
        high: number;
        critical: number;
    };

    targetTypeBreakdown: {
        post: number;
        story: number;
        user: number;
        comment: number;
    };

    topReasons: Array<{
        reason: string;
        count: number;
    }>;

    resolutionTrend: Array<{
        date: string;
        resolved: number;
        dismissed: number;
    }>;

    adminPerformance: Array<{
        adminId: string;
        adminName: string;
        reportsHandled: number;
        averageResolutionTime: number;
    }>;
}
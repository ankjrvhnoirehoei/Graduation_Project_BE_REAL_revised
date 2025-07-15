import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ReportRepository } from './report.repository';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportResponseDto, ReportStatsDto } from './dto/report-response.dto';
import { Report, ReportDocument, ReportStatus, AdminAction, ReportPriority, ReportReason } from './report.schema';
import { PostService } from '../post/post.service';
import { UserService } from '../user/user.service';
import { Post } from '../post/post.schema';

@Injectable()
export class ReportService {
    constructor(
        private readonly reportRepository: ReportRepository,
        private readonly postService: PostService,
        private readonly userService: UserService,
        @InjectModel(Post.name) private readonly postModel: Model<Post>,
        @InjectModel(Report.name) private readonly reportModel: Model<ReportDocument>,
    ) { }

    async createReport(userId: string, createReportDto: CreateReportDto): Promise<ReportResponseDto> {
        // Validate target exists (only Posts)
        await this.validateTarget(createReportDto.targetId);

        // Check if user already reported this target
        const existingReport = await this.reportModel.findOne({
            reporterId: new Types.ObjectId(userId),
            targetId: new Types.ObjectId(createReportDto.targetId),
            status: { $in: [ReportStatus.PENDING, ReportStatus.REVIEWED] }
        });

        if (existingReport) {
            throw new BadRequestException('Bạn đã báo cáo nội dung này rồi');
        }

        // Calculate priority based on existing report count for this target
        const reportCount = await this.reportModel.countDocuments({
            targetId: new Types.ObjectId(createReportDto.targetId)
        });

        const priority = this.calculatePriority(reportCount + 1); // +1 for the current report

        const report = await this.reportModel.create({
            reporterId: new Types.ObjectId(userId),
            targetId: new Types.ObjectId(createReportDto.targetId),
            reason: createReportDto.reason,
            description: createReportDto.description,
            priority,
            status: ReportStatus.PENDING,
            createdAt: new Date(),
        });

        return this.populateReport(report);
    }

    async getMyReports(userId: string, query: ReportQueryDto): Promise<{
        reports: ReportResponseDto[];
        total: number;
        page: number;
        limit: number;
    }> {
        const { page = 1, limit = 20, status } = query;
        const skip = (page - 1) * limit;

        const filter: any = { reporterId: new Types.ObjectId(userId) };
        if (status) filter.status = status;

        const [reports, total] = await Promise.all([
            this.reportModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            this.reportModel.countDocuments(filter),
        ]);

        const populatedReports = await Promise.all(
            reports.map((report: any) => this.populateReport(report))
        );

        return {
            reports: populatedReports,
            total,
            page,
            limit,
        };
    }

    async getAllReports(query: ReportQueryDto): Promise<{
        reports: ReportResponseDto[];
        total: number;
        page: number;
        limit: number;
    }> {
        const { page = 1, limit = 20, status, priority, search } = query;
        const skip = (page - 1) * limit;

        const filter: any = {};
        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (search) {
            filter.$or = [
                { reason: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }

        const [reports, total] = await Promise.all([
            this.reportModel
                .find(filter)
                .sort({ createdAt: -1, priority: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            this.reportModel.countDocuments(filter),
        ]);

        const populatedReports = await Promise.all(
            reports.map((report: any) => this.populateReport(report))
        );

        return {
            reports: populatedReports,
            total,
            page,
            limit,
        };
    }

    async getReportById(reportId: string): Promise<ReportResponseDto> {
        const report = await this.reportRepository.findOne({
            _id: new Types.ObjectId(reportId)
        });

        return this.populateReport(report);
    }

    async resolveReport(
        reportId: string,
        adminId: string,
        resolveReportDto: ResolveReportDto
    ): Promise<ReportResponseDto> {
        const report = await this.reportRepository.findOne({
            _id: new Types.ObjectId(reportId)
        });

        // Execute admin action if specified
        if (resolveReportDto.adminAction) {
            await this.executeAdminAction(
                report.targetId.toString(),
                resolveReportDto.adminAction
            );
        }

        const updatedReport = await this.reportRepository.findOneAndUpdate(
            { _id: new Types.ObjectId(reportId) },
            {
                status: resolveReportDto.status,
                adminId: new Types.ObjectId(adminId),
                adminAction: resolveReportDto.adminAction,
                adminNote: resolveReportDto.adminNote,
                resolvedAt: resolveReportDto.status === ReportStatus.RESOLVED ? new Date() : undefined,
            }
        );

        return this.populateReport(updatedReport);
    }

    async deleteReport(reportId: string, userId: string): Promise<void> {
        const report = await this.reportRepository.findOne({
            _id: new Types.ObjectId(reportId)
        });

        // Only allow reporter to delete their own pending reports
        if (report.reporterId.toString() !== userId || report.status !== ReportStatus.PENDING) {
            throw new ForbiddenException('Không thể xóa báo cáo này');
        }

        await this.reportRepository.findOneAndDelete({
            _id: new Types.ObjectId(reportId)
        });
    }

    async getReportStats(): Promise<ReportStatsDto> {
        const [
            totalReports,
            pendingReports,
            resolvedReports,
            dismissedReports,
            reportsByPriority,
        ] = await Promise.all([
            this.reportModel.countDocuments(),
            this.reportModel.countDocuments({ status: ReportStatus.PENDING }),
            this.reportModel.countDocuments({ status: ReportStatus.RESOLVED }),
            this.reportModel.countDocuments({ status: ReportStatus.DISMISSED }),
            this.reportModel.aggregate([
                { $group: { _id: '$priority', count: { $sum: 1 } } }
            ]),
        ]);

        const priorityStats = { low: 0, medium: 0, high: 0, critical: 0 };
        reportsByPriority.forEach((item: any) => {
            priorityStats[item._id] = item.count;
        });

        return {
            totalReports,
            pendingReports,
            resolvedReports,
            dismissedReports,
            reportsByPriority: priorityStats,
        };
    }

    async bulkResolveReports(
        adminId: string,
        bulkResolveDto: any
    ): Promise<{ success: number; failed: number; errors: string[] }> {
        const { reportIds, status, adminAction, adminNote } = bulkResolveDto;
        const results = { success: 0, failed: 0, errors: [] };

        for (const reportId of reportIds) {
            try {
                await this.resolveReport(reportId, adminId, {
                    status,
                    adminAction,
                    adminNote,
                });
                results.success++;
            } catch (error: any) {
                results.failed++;
                results.errors.push(`Report ${reportId}: ${error.message}`);
            }
        }

        return results;
    }

    async getReportAnalytics(): Promise<any> {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [
            totalReports,
            reportsThisWeek,
            reportsThisMonth,
            statusBreakdown,
            priorityBreakdown,
            topReasons,
        ] = await Promise.all([
            this.reportModel.countDocuments(),
            this.reportModel.countDocuments({ createdAt: { $gte: weekAgo } }),
            this.reportModel.countDocuments({ createdAt: { $gte: monthAgo } }),
            this.reportModel.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            this.reportModel.aggregate([
                { $group: { _id: '$priority', count: { $sum: 1 } } }
            ]),
            this.reportModel.aggregate([
                { $group: { _id: '$reason', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),
        ]);

        // Process results
        const statusStats = { pending: 0, reviewed: 0, resolved: 0, dismissed: 0 };
        statusBreakdown.forEach((item: any) => {
            statusStats[item._id] = item.count;
        });

        const priorityStats = { low: 0, medium: 0, high: 0, critical: 0 };
        priorityBreakdown.forEach((item: any) => {
            priorityStats[item._id] = item.count;
        });

        return {
            totalReports,
            reportsThisWeek,
            reportsThisMonth,
            statusBreakdown: statusStats,
            priorityBreakdown: priorityStats,
            topReasons: topReasons.map((item: any) => ({
                reason: item._id,
                count: item.count
            }))
        };
    }

    private async validateTarget(targetId: string): Promise<void> {
        try {
            const post = await this.postModel.findById(targetId);
            if (!post) throw new NotFoundException('Bài viết không tồn tại');
        } catch (error) {
            throw new BadRequestException('Không tìm thấy bài viết cần báo cáo');
        }
    }

    private async executeAdminAction(
        targetId: string,
        action: AdminAction
    ): Promise<void> {
        switch (action) {
            case AdminAction.DISABLE:
                await this.postService.disablePost(targetId);
                break;
            case AdminAction.DELETE:
                await this.postModel.findByIdAndUpdate(targetId, { isFlagged: true, isEnable: false });
                break;
            case AdminAction.WARNING:
                // Implement warning system if needed
                break;
            case AdminAction.NO_ACTION:
                // Do nothing
                break;
        }
    }

    private async populateReport(report: any): Promise<ReportResponseDto> {
        const populatedReport = { ...report };

        // Populate reporter
        try {
            const reporter = await this.userService.findById(report.reporterId.toString());
            populatedReport.reporter = {
                _id: reporter._id,
                username: reporter.username,
                handleName: reporter.handleName,
                profilePic: reporter.profilePic,
            };
        } catch (error) {
            // Reporter might be deleted
        }

        // Populate admin if exists
        if (report.adminId) {
            try {
                const admin = await this.userService.findById(report.adminId.toString());
                populatedReport.admin = {
                    _id: admin._id,
                    username: admin.username,
                    handleName: admin.handleName,
                };
            } catch (error) {
                // Admin might be deleted
            }
        }

        // Populate target (only Posts)
        try {
            const post = await this.postModel.findById(report.targetId.toString()).lean();
            populatedReport.target = post ? {
                _id: post._id,
                caption: post.caption,
                type: post.type,
                isEnable: post.isEnable,
                isFlagged: post.isFlagged
            } : null;
        } catch (error) {
            // Target might be deleted
            populatedReport.target = null;
        }

        return populatedReport;
    }

    private calculatePriority(reportCount: number): ReportPriority {
        if (reportCount < 3) {
            return ReportPriority.LOW;
        } else if (reportCount >= 3 && reportCount < 5) {
            return ReportPriority.MEDIUM;
        } else if (reportCount >= 5 && reportCount < 8) {
            return ReportPriority.HIGH;
        } else {
            return ReportPriority.CRITICAL;
        }
    }
}
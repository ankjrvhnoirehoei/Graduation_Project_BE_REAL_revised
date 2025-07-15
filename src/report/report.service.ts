import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ReportRepository } from './report.repository';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportResponseDto, ReportStatsDto } from './dto/report-response.dto';
import { Report, ReportDocument, ReportStatus, ReportTargetType, AdminAction, ReportPriority } from './report.schema';
import { PostService } from '../post/post.service';
import { UserService } from '../user/user.service';
import { Post } from '../post/post.schema';
import { Story } from '../story/schema/story.schema';
import { Comment } from '../comment/comment.schema';

@Injectable()
export class ReportService {
    constructor(
        private readonly reportRepository: ReportRepository,
        private readonly postService: PostService,
        private readonly userService: UserService,
        @InjectModel(Post.name) private readonly postModel: Model<Post>,
        @InjectModel(Story.name) private readonly storyModel: Model<Story>,
        @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
        @InjectModel(Report.name) private readonly reportModel: Model<ReportDocument>,
    ) { }

    async createReport(userId: string, createReportDto: CreateReportDto): Promise<ReportResponseDto> {
        // Validate target exists
        await this.validateTarget(createReportDto.targetType, createReportDto.targetId);

        // Check if user already reported this target
        const existingReport = await this.reportModel.findOne({
            reporterId: new Types.ObjectId(userId),
            targetType: createReportDto.targetType,
            targetId: new Types.ObjectId(createReportDto.targetId),
            status: { $in: [ReportStatus.PENDING, ReportStatus.REVIEWED] }
        });

        if (existingReport) {
            throw new BadRequestException('Bạn đã báo cáo nội dung này rồi');
        }

        const report = await this.reportModel.create({
            reporterId: new Types.ObjectId(userId),
            targetType: createReportDto.targetType,
            targetId: new Types.ObjectId(createReportDto.targetId),
            reason: createReportDto.reason,
            description: createReportDto.description,
            priority: createReportDto.priority || ReportPriority.MEDIUM,
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
        const { page = 1, limit = 20, status, targetType } = query;
        const skip = (page - 1) * limit;

        const filter: any = { reporterId: new Types.ObjectId(userId) };
        if (status) filter.status = status;
        if (targetType) filter.targetType = targetType;

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
        const { page = 1, limit = 20, status, targetType, priority, search } = query;
        const skip = (page - 1) * limit;

        const filter: any = {};
        if (status) filter.status = status;
        if (targetType) filter.targetType = targetType;
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
                report.targetType,
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
            reportsByType,
            reportsByPriority,
        ] = await Promise.all([
            this.reportModel.countDocuments(),
            this.reportModel.countDocuments({ status: ReportStatus.PENDING }),
            this.reportModel.countDocuments({ status: ReportStatus.RESOLVED }),
            this.reportModel.countDocuments({ status: ReportStatus.DISMISSED }),
            this.reportModel.aggregate([
                { $group: { _id: '$targetType', count: { $sum: 1 } } }
            ]),
            this.reportModel.aggregate([
                { $group: { _id: '$priority', count: { $sum: 1 } } }
            ]),
        ]);

        const typeStats = { post: 0, story: 0, user: 0, comment: 0 };
        reportsByType.forEach((item: any) => {
            typeStats[item._id] = item.count;
        });

        const priorityStats = { low: 0, medium: 0, high: 0, critical: 0 };
        reportsByPriority.forEach((item: any) => {
            priorityStats[item._id] = item.count;
        });

        return {
            totalReports,
            pendingReports,
            resolvedReports,
            dismissedReports,
            reportsByType: typeStats,
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
            targetTypeBreakdown,
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
                { $group: { _id: '$targetType', count: { $sum: 1 } } }
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

        const typeStats = { post: 0, story: 0, user: 0, comment: 0 };
        targetTypeBreakdown.forEach((item: any) => {
            typeStats[item._id] = item.count;
        });

        return {
            totalReports,
            reportsThisWeek,
            reportsThisMonth,
            statusBreakdown: statusStats,
            priorityBreakdown: priorityStats,
            targetTypeBreakdown: typeStats,
            topReasons: topReasons.map((item: any) => ({
                reason: item._id,
                count: item.count
            }))
        };
    }

    private async validateTarget(targetType: ReportTargetType, targetId: string): Promise<void> {
        try {
            switch (targetType) {
                case ReportTargetType.POST:
                    const post = await this.postModel.findById(targetId);
                    if (!post) throw new NotFoundException('Post not found');
                    break;
                case ReportTargetType.STORY:
                    const story = await this.storyModel.findById(targetId);
                    if (!story) throw new NotFoundException('Story not found');
                    break;
                case ReportTargetType.USER:
                    const user = await this.userService.findById(targetId);
                    if (!user) throw new NotFoundException('User not found');
                    break;
                case ReportTargetType.COMMENT:
                    const comment = await this.commentModel.findById(targetId);
                    if (!comment) throw new NotFoundException('Comment not found');
                    break;
                default:
                    throw new BadRequestException('Loại báo cáo không hợp lệ');
            }
        } catch (error) {
            throw new BadRequestException('Không tìm thấy nội dung cần báo cáo');
        }
    }

    private async executeAdminAction(
        targetType: ReportTargetType,
        targetId: string,
        action: AdminAction
    ): Promise<void> {
        switch (action) {
            case AdminAction.DISABLE:
                if (targetType === ReportTargetType.POST) {
                    await this.postService.disablePost(targetId);
                } else if (targetType === ReportTargetType.USER) {
                    await this.userService.disableUser(targetId);
                }
                break;
            case AdminAction.DELETE:
                if (targetType === ReportTargetType.POST) {
                    await this.postModel.findByIdAndUpdate(targetId, { isFlagged: true, isEnable: false });
                } else if (targetType === ReportTargetType.STORY) {
                    await this.storyModel.findByIdAndUpdate(targetId, { isArchived: true });
                } else if (targetType === ReportTargetType.COMMENT) {
                    await this.commentModel.findByIdAndUpdate(targetId, { isDeleted: true });
                }
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

        // Populate target based on type
        try {
            switch (report.targetType) {
                case ReportTargetType.POST:
                    const post = await this.postModel.findById(report.targetId.toString()).lean();
                    populatedReport.target = post ? {
                        _id: post._id,
                        caption: post.caption,
                        type: post.type,
                        isEnable: post.isEnable,
                        isFlagged: post.isFlagged
                    } : null;
                    break;
                case ReportTargetType.STORY:
                    const story = await this.storyModel.findById(report.targetId.toString()).lean();
                    populatedReport.target = story ? {
                        _id: story._id,
                        type: story.type,
                        mediaUrl: story.mediaUrl,
                        isArchived: story.isArchived
                    } : null;
                    break;
                case ReportTargetType.USER:
                    const user = await this.userService.findById(report.targetId.toString());
                    populatedReport.target = user ? {
                        _id: user._id,
                        username: user.username,
                        handleName: user.handleName,
                        profilePic: user.profilePic,
                    } : null;
                    break;
                case ReportTargetType.COMMENT:
                    const comment = await this.commentModel.findById(report.targetId.toString()).lean();
                    populatedReport.target = comment ? {
                        _id: comment._id,
                        content: comment.content,
                        isDeleted: comment.isDeleted
                    } : null;
                    break;
            }
        } catch (error) {
            // Target might be deleted
            populatedReport.target = null;
        }

        return populatedReport;
    }
}
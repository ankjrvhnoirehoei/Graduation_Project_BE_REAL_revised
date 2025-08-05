import { Types } from 'mongoose';
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReportContent, ReportContentDocument } from './report-content.schema';
import { CreateReportUserDto } from '../report-user/dto/create-report.dto';
import { UserService } from 'src/user/user.service';
import { AdminService } from 'src/admin/admin.service';
import { ReportReason } from './report-content.schema';
import { CommonServices } from 'src/admin/helpers/helpers.service';
import { PostService } from 'src/post/post.service';
import { NotificationService } from 'src/notification/notification.service';
interface PaginationOptions {
  page: number;
  limit: number;
}

interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
@Injectable()
export class ReportContentService {
  constructor(
    @InjectModel(ReportContent.name)
    private readonly reportModel: Model<ReportContentDocument>,
    private readonly userService: UserService,
    private readonly adminService: AdminService,
    private readonly commonService: CommonServices,
    private readonly postService: PostService,
    private readonly notificationService: NotificationService,
  ) {}

async createReport(
  dto: CreateReportUserDto,
  reporterId: string,
): Promise<ReportContent> {
  // prevent duplicate reports
  const exists = await this.reportModel
    .findOne({ reporterId: new Types.ObjectId(reporterId), targetId: new Types.ObjectId(dto.targetId) })
    .exec();
  if (exists) {
    throw new ConflictException('Bạn đã report bài viết này.');
  }

  const created = new this.reportModel({
    reporterId: new Types.ObjectId(reporterId),
    targetId: new Types.ObjectId(dto.targetId),
    reason: dto.reason,
    description: dto.description,
  });
  return created.save();
}

  async findById(id: string): Promise<ReportContent> {
    const report = await this.reportModel.findById(id).exec();
    if (!report) throw new NotFoundException('Không tìm thấy báo cáo!');
    return report;
  }

  async revokeReport(id: string): Promise<void> {
    const result = await this.reportModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Không tìm thấy báo cáo!');
  }

  // Admin-related
  async getAllReports(options: PaginationOptions): Promise<PaginatedResponse<ReportContent>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [data, totalCount] = await Promise.all([
      this.reportModel
        .find()
        .lean()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.reportModel.countDocuments().exec(),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data,
      totalCount,
      currentPage: page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async getUnreadReports(options: PaginationOptions): Promise<PaginatedResponse<ReportContent>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [data, totalCount] = await Promise.all([
      this.reportModel
        .find({ isRead: false })
        .sort({ createdAt: -1 })
        .lean()
        .skip(skip)
        .limit(limit)
        .exec(),
      this.reportModel.countDocuments({ isRead: false }).exec(),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data,
      totalCount,
      currentPage: page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async getUnresolvedReports(options: PaginationOptions): Promise<PaginatedResponse<ReportContent>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [data, totalCount] = await Promise.all([
      this.reportModel
        .find({ resolved: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .lean()
        .limit(limit)
        .exec(),
      this.reportModel.countDocuments({ resolved: false }).exec(),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data,
      totalCount,
      currentPage: page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async markAllReportsAsRead(): Promise<{ modifiedCount: number }> {
    const result = await this.reportModel
      .updateMany(
        { isRead: false },
        { $set: { isRead: true } }
      )
      .lean()
      .exec();

    return { modifiedCount: result.modifiedCount };
  }

  async getReportsByTargetId(targetId: string, options: PaginationOptions): Promise<PaginatedResponse<ReportContent>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [data, totalCount] = await Promise.all([
      this.reportModel
        .find({ targetId: new Types.ObjectId(targetId) })
        .sort({ createdAt: -1 })
        .lean()
        .skip(skip)
        .limit(limit)
        .exec(),
      this.reportModel.countDocuments({ targetId: new Types.ObjectId(targetId) }).exec(),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data,
      totalCount,
      currentPage: page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async dismissReport(id: string): Promise<ReportContent> {
    const report = await this.reportModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            resolved: true,
            isDismissed: true,
            isRead: true,
          },
        },
        { new: true }
      )
      .lean()
      .exec();

    if (!report) throw new NotFoundException('Không tìm thấy báo cáo!');
    return report;
  }

  async resolveReport(id: string, adminId: string): Promise<ReportContent> {
    const report = await this.reportModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            resolved: true,
            isRead: true,
          },
        },
        { new: true }
      )
      // .lean()
      .exec();

    if (!report) throw new NotFoundException('Không tìm thấy báo cáo!');

    // count resolved reports for this target
    const resolvedReportsCount = await this.reportModel
      .countDocuments({
        targetId: report.targetId,
        resolved: true,
      })
      .exec();

    let targetBanned = false;

    // if this is the 3rd resolved report, disable the post
    if (resolvedReportsCount >= 3) {
      try {
        await this.postService.disablePost(report.targetId.toString());
        targetBanned = true;
      } catch (error) {
        console.error('Error disabling post:', error);
      }
    }

    await this.sendNotifications(report, targetBanned, adminId);

    return report;
  }

  private async sendNotifications(
    report: ReportContentDocument,
    targetBanned: boolean,
    adminId: string,
  ): Promise<void> {
    try {
      if (targetBanned) {
        // auto-resolve all other unresolved reports for this target
        const unresolvedReports = await this.reportModel
          .find({
            targetId: report.targetId,
            resolved: false,
            _id: { $ne: report._id }, // exclude the current report
          })
          .exec();

        if (unresolvedReports.length > 0) {
          await this.reportModel
            .updateMany(
              {
                targetId: report.targetId,
                resolved: false,
                _id: { $ne: report._id },
              },
              {
                $set: {
                  resolved: true,
                  isRead: true,
                },
              }
            )
            .exec();
        }

        const allResolvedReports = await this.reportModel
          .find({
            targetId: report.targetId,
            resolved: true,
          })
          .exec();

        const allReporterIds = allResolvedReports.map(r => r.reporterId.toString());

        // send notification to ALL reporters
        await this.notificationService.sendPushNotification(
          allReporterIds,
          adminId,
          'Báo cáo đã được xử lý',
          'Nội dung bạn báo cáo đã bị xóa do vi phạm quy định cộng đồng. Cảm ơn bạn đã góp phần xây dựng môi trường lành mạnh.',
          {
            type: 'REPORT_TARGET_BANNED',
            reportId: report._id.toString(),
            targetId: report.targetId.toString(),
            targetType: 'content',
          }
        );
      } else {
        // send notification to the single reporter about resolution
        await this.notificationService.sendPushNotification(
          [report.reporterId.toString()],
          adminId,
          'Báo cáo đã được xem xét',
          'Báo cáo của bạn đã được admin xem xét và xử lý. Cảm ơn bạn đã góp phần duy trì môi trường cộng đồng tích cực.',
          {
            type: 'REPORT_RESOLVED',
            reportId: report._id.toString(),
            targetId: report.targetId.toString(),
            targetType: 'content',
          }
        );
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }

  async getReportReasonsActivity(
    adminId: string,
    range: '7days' | '30days' | 'year',
  ): Promise<{
    success: boolean;
    range: '7days' | '30days' | 'year';
    unit: 'day' | 'month';
    from: string;
    to: string;
    data: Array<{ 
      period: string; 
      HARASSMENT_AND_BULLYING: number;
      HATE_SPEECH: number;
      IMPERSONATION_FAKE_ACCOUNTS: number;
      GRAPHIC_CONTENT: number;
      THREATS_AND_VIOLENCE: number;
      SCAMS_AND_FRAUD: number;
      SENSITIVE_PERSONAL_INFO: number;
      SELF_HARM: number;
      OTHER: number;
    }>;
  }> {
    // Ensure admin access
    await this.adminService.ensureAdmin(adminId);
    
    // Get range configuration using admin service helper
    const { from, to, unit } = this.commonService.buildRange(range);

    // Get aggregated data for each report reason
    const [
      harassmentRaw,
      hateSpeechRaw,
      impersonationRaw,
      graphicContentRaw,
      threatsRaw,
      scamsRaw,
      personalInfoRaw,
      selfHarmRaw,
      otherRaw
    ] = await Promise.all([
      this.reportModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.HARASSMENT_AND_BULLYING })
      ),
      this.reportModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.HATE_SPEECH })
      ),
      this.reportModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.IMPERSONATION_FAKE_ACCOUNTS })
      ),
      this.reportModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.GRAPHIC_CONTENT })
      ),
      this.reportModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.THREATS_AND_VIOLENCE })
      ),
      this.reportModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.SCAMS_AND_FRAUD })
      ),
      this.reportModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.SENSITIVE_PERSONAL_INFO })
      ),
      this.reportModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.SELF_HARM })
      ),
      this.reportModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.OTHER })
      ),
    ]);

    const dataMaps = [
      new Map(harassmentRaw.map(d => [d._id, d.count])),
      new Map(hateSpeechRaw.map(d => [d._id, d.count])),
      new Map(impersonationRaw.map(d => [d._id, d.count])),
      new Map(graphicContentRaw.map(d => [d._id, d.count])),
      new Map(threatsRaw.map(d => [d._id, d.count])),
      new Map(scamsRaw.map(d => [d._id, d.count])),
      new Map(personalInfoRaw.map(d => [d._id, d.count])),
      new Map(selfHarmRaw.map(d => [d._id, d.count])),
      new Map(otherRaw.map(d => [d._id, d.count]))
    ];

    const dataKeys = [
      'HARASSMENT_AND_BULLYING',
      'HATE_SPEECH',
      'IMPERSONATION_FAKE_ACCOUNTS',
      'GRAPHIC_CONTENT',
      'THREATS_AND_VIOLENCE',
      'SCAMS_AND_FRAUD',
      'SENSITIVE_PERSONAL_INFO',
      'SELF_HARM',
      'OTHER'
    ];

    const timeSeriesData = this.commonService.buildTimeSeriesData(
      from,
      to,
      unit,
      dataMaps,
      dataKeys
    );

    return {
      success: true,
      range,
      unit,
      from: this.commonService.formatDate(from),
      to: this.commonService.formatDate(to),
      data: timeSeriesData
    };
  }
}
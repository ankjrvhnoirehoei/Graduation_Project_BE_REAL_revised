import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ReportUser,
  ReportUserDocument,
} from './report-user.schema';
import { CreateReportUserDto } from './dto/create-report.dto';
import { UserService } from 'src/user/user.service';
import { AdminService } from 'src/admin/admin.service';
import { ReportReason } from './report-user.schema'; 
import { CommonServices } from 'src/admin/helpers/helpers.service';
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
export class ReportUserService {
  constructor(
    @InjectModel(ReportUser.name)
    private reportUserModel: Model<ReportUserDocument>,
    private readonly userService: UserService,
    private readonly adminService: AdminService,
    private readonly commonService: CommonServices,
    private readonly notificationService: NotificationService,
  ) {}

  async create(
    reporterId: string,
    dto: CreateReportUserDto,
  ): Promise<ReportUser> {
    // prevent duplicate reports
    const exists = await this.reportUserModel
      .findOne({ reporterId, targetId: dto.targetId })
      .exec();
    if (exists) {
      throw new ConflictException('Bạn đã report người dùng này.');
    }
    const created = new this.reportUserModel({
      reporterId: new Types.ObjectId(reporterId),
      targetId: new Types.ObjectId(dto.targetId),
      reason: dto.reason,
      description: dto.description,
    });
    return created.save();
  }

  async findAll(): Promise<ReportUser[]> {
    return this.reportUserModel.find().exec();
  }

  async findById(id: string): Promise<ReportUser> {
    const report = await this.reportUserModel.findById(id).exec();
    if (!report) throw new NotFoundException('Không tìm thấy báo cáo!');
    return report;
  }
  
  async revokeReport(id: string): Promise<void> {
    const result = await this.reportUserModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Không tìm thấy báo cáo!');
  }

  // Admin-related
  async getAllReports(options: PaginationOptions): Promise<PaginatedResponse<ReportUser>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [data, totalCount] = await Promise.all([
      this.reportUserModel
        .find()
        .lean()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.reportUserModel.countDocuments().exec(),
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

  async getUnreadReports(options: PaginationOptions): Promise<PaginatedResponse<ReportUser>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [data, totalCount] = await Promise.all([
      this.reportUserModel
        .find({ isRead: false })
        .sort({ createdAt: -1 })
        .lean()
        .skip(skip)
        .limit(limit)
        .exec(),
      this.reportUserModel.countDocuments({ isRead: false }).exec(),
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

  async getUnresolvedReports(options: PaginationOptions): Promise<PaginatedResponse<ReportUser>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [data, totalCount] = await Promise.all([
      this.reportUserModel
        .find({ resolved: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .lean()
        .limit(limit)
        .exec(),
      this.reportUserModel.countDocuments({ resolved: false }).exec(),
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
    const result = await this.reportUserModel
      .updateMany(
        { isRead: false },
        { $set: { isRead: true } }
      )
      .lean()
      .exec();

    return { modifiedCount: result.modifiedCount };
  }

  async getReportsByTargetId(targetId: string, options: PaginationOptions): Promise<PaginatedResponse<ReportUser>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [data, totalCount] = await Promise.all([
      this.reportUserModel
        .find({ targetId: new Types.ObjectId(targetId) })
        .sort({ createdAt: -1 })
        .lean()
        .skip(skip)
        .limit(limit)
        .exec(),
      this.reportUserModel.countDocuments({ targetId: new Types.ObjectId(targetId) }).exec(),
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

  async dismissReport(id: string): Promise<ReportUser> {
    const report = await this.reportUserModel
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

  async banResolveReport(id: string, adminId: string): Promise<ReportUser> {
    const report = await this.reportUserModel
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
      .exec();

    if (!report) throw new NotFoundException('Không tìm thấy báo cáo!');

    // ban the user
    let targetBanned = false;
    try {
      await this.userService.disableUser(report.targetId.toString());
      targetBanned = true;
    } catch (error) {
      console.error('Error disabling user:', error);
      throw error;
    }

    await this.sendNotifications(report, targetBanned, adminId);

    return report;
  }

  async resolveReport(id: string, adminId: string): Promise<ReportUser> {
    const report = await this.reportUserModel
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
      .exec();

    if (!report) throw new NotFoundException('Không tìm thấy báo cáo!');

    // count resolved reports for this target
    const resolvedReportsCount = await this.reportUserModel
      .countDocuments({
        targetId: report.targetId,
        resolved: true,
        isDismissed: false,
      })
      .exec();

    let targetBanned = false;

    // if this is the 3rd resolved report, ban the user
    if (resolvedReportsCount >= 3) {
      try {
        await this.userService.disableUser(report.targetId.toString());
        targetBanned = true;
      } catch (error) {
        console.error('Error disabling user:', error);
      }
    }

    await this.sendNotifications(report, targetBanned, adminId);

    return report;
  }

  private async sendNotifications(
    report: ReportUserDocument,
    targetBanned: boolean,
    adminId: string,
  ): Promise<void> {
    try {
      if (targetBanned) {
        // auto-resolve all other unresolved reports for this target
        const unresolvedReports = await this.reportUserModel
          .find({
            targetId: report.targetId,
            resolved: false,
            _id: { $ne: report._id }, // excluding the current report
          })
          .exec();

        if (unresolvedReports.length > 0) {
          await this.reportUserModel
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

        const allResolvedReports = await this.reportUserModel
          .find({
            targetId: report.targetId,
            resolved: true,
          })
          .exec();

        const allReporterIds = allResolvedReports.map(r => r.reporterId.toString());

        // send ban notification to ALL reporters
        await this.notificationService.sendPushNotification(
          allReporterIds,
          adminId,
          'Báo cáo đã được xử lý',
          'Người dùng bạn báo cáo đã bị khóa tài khoản do vi phạm quy định cộng đồng. Cảm ơn bạn đã góp phần xây dựng môi trường lành mạnh.',
          {
            type: 'REPORT_TARGET_BANNED',
            reportId: report._id.toString(),
            targetId: report.targetId.toString(),
            targetType: 'user',
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
            targetType: 'user',
          }
        );
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }

  async getReportedUsersActivity(
    adminId: string,
    range: '7days' | '30days' | 'year',
  ): Promise<{
    success: boolean;
    range: '7days' | '30days' | 'year';
    unit: 'day' | 'month';
    from: string;
    to: string;
    data: Array<{ period: string; [handleName: string]: number | string }>;
  }> {
    // Ensure admin access
    await this.adminService.ensureAdmin(adminId);
    
    // Get range configuration using admin service helper
    const { from, to, unit } = this.commonService.buildRange(range);

    // Use commonService helper to build aggregation pipeline
    const reportData = await this.reportUserModel.aggregate([
      ...this.commonService.buildTimeAggregation(
        from,
        to,
        unit,
        {},
        'createdAt'
      ),
      {
        $lookup: {
          from: 'reportusers',
          let: { period: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $gte: ['$createdAt', from] },
                    { $lte: ['$createdAt', to] },
                  ]
                }
              }
            },
            {
              $group: {
                _id: {
                  targetId: '$targetId',
                  period: unit === 'day'
                    ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                    : { $month: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            {
              $match: {
                '_id.period': '$period'
              }
            }
          ],
          as: 'userReports'
        }
      }
    ]);

    // Simplified approach: Get all reports in the time range and process them
    const allReports = await this.reportUserModel.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
        }
      },
      {
        $group: {
          _id: {
            targetId: '$targetId',
            period: unit === 'day'
              ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
              : { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.targetId',
          reports: {
            $push: {
              period: '$_id.period',
              count: '$count'
            }
          },
          totalReports: { $sum: '$count' }
        }
      },
      {
        $sort: { totalReports: -1 }
      },
      {
        $limit: 20
      }
    ]);

    // Get user details for the reported users
    const userIds = allReports.map(item => item._id);
    const users = await this.userService.findManyByIds(userIds.map(id => id.toString()));
    
    // Create a map of userId to handleName
    const userHandleMap = new Map();
    users.forEach(user => {
      userHandleMap.set(user._id.toString(), user.handleName);
    });

    // Create maps for each user's report data
    const userDataMaps = allReports.map(userData => {
      const reportMap = new Map();
      userData.reports.forEach(report => {
        reportMap.set(report.period, report.count);
      });
      return reportMap;
    });

    // Get user handle names in the same order
    const userHandles = allReports.map(userData => 
      userHandleMap.get(userData._id.toString()) || 'Unknown'
    );

    // Use commonService helper to build time series data
    const timeSeriesData = this.commonService.buildTimeSeriesData(
      from,
      to,
      unit,
      userDataMaps,
      userHandles
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
      this.reportUserModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.HARASSMENT_AND_BULLYING })
      ),
      this.reportUserModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.HATE_SPEECH })
      ),
      this.reportUserModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.IMPERSONATION_FAKE_ACCOUNTS })
      ),
      this.reportUserModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.GRAPHIC_CONTENT })
      ),
      this.reportUserModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.THREATS_AND_VIOLENCE })
      ),
      this.reportUserModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.SCAMS_AND_FRAUD })
      ),
      this.reportUserModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.SENSITIVE_PERSONAL_INFO })
      ),
      this.reportUserModel.aggregate(
        this.commonService.buildTimeAggregation(from, to, unit, { reason: ReportReason.SELF_HARM })
      ),
      this.reportUserModel.aggregate(
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
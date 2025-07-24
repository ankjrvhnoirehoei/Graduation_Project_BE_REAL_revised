import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger, HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { ReportStoryRepository } from './report-story.repository';
import { ReportStatus } from './schema/report-story.schema';
import { CreateReportStoryDto } from './dto/create-report-story.dto';
import { UpdateReportStoryDto } from './dto/update-report-story.dto';
import { QueryReportStoryDto } from './dto/query-report-story.dto';

@Injectable()
export class ReportStoryService {
  private readonly logger: Logger = new Logger(ReportStoryService.name);

  constructor(
    private readonly reportStoryRepo: ReportStoryRepository,
  ) {}

  async create(createReportStoryDto: CreateReportStoryDto, reporterId: string) {
    const reporterObjectId = new Types.ObjectId(reporterId);
    
    const existingReport = await this.reportStoryRepo.findExistingReport(
      reporterObjectId,
      new Types.ObjectId(createReportStoryDto.targetId)
    );

    if (existingReport) {
      throw new ConflictException('You have already reported this story');
    }

    const report = await this.reportStoryRepo.createReport({
      ...createReportStoryDto,
      reporterId: reporterObjectId,
    });

    return {
      statusCode: HttpStatus.CREATED,
      message: 'success',
      data: report,
    };
  }

  async findAll(queryDto: QueryReportStoryDto) {
    const limit = 20;
    const { page = 1, startDate, endDate, ...filters } = queryDto;
    const skip = (page - 1) * limit;

    // Build query
    const query: any = { ...filters };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const reports = await Promise.all([
      this.reportStoryRepo.model
        .find(query)
        .populate('reporterId', 'username email handleName profilePic')
        .populate('targetId', 'mediaUrl content ownerId')
        .populate('reviewerId', 'username email handleName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    return {
      statusCode: HttpStatus.OK,
      message: 'Success',
      data: {
        reports,
        pagination: {
          currentPage: page,
          itemsPerPage: limit
        }
      }
    };
  }

  async findOne(id: string) {
    const report = await this.reportStoryRepo.model
      .findById(id)
      .populate('reporterId', 'username email handleName profilePic')
      .populate('targetId', 'mediaUrl content ownerId')
      .populate('reviewerId', 'username email handleName')
      .lean()
      .exec();

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Success',
      data: report,
    };
  }

  async update(id: string, updateReportStoryDto: UpdateReportStoryDto, reviewerId?: string) {
    const reportId = new Types.ObjectId(id);
    
    try {
      const report = await this.reportStoryRepo.findOne({ _id: reportId });
      
      // Set reviewer if provided
      if (reviewerId && updateReportStoryDto.status) {
        updateReportStoryDto.reviewerId = new Types.ObjectId(reviewerId);
      }

      const updatedReport = await this.reportStoryRepo.updateReport(reportId, updateReportStoryDto);

      return {
        statusCode: HttpStatus.OK,
        message: 'Report updated successfully',
        data: updatedReport,
      };
    } catch (error) {
      throw new NotFoundException('Report not found');
    }
  }

  async remove(id: string, userId: string, isAdmin: boolean = false) {
    const reportId = new Types.ObjectId(id);
    const userObjectId = new Types.ObjectId(userId);
    
    try {
      const report = await this.reportStoryRepo.findOne({ _id: reportId });
      
      // Only reporter or admin can delete
      if (!isAdmin && !report.reporterId.equals(userObjectId)) {
        throw new ForbiddenException('You can only delete your own reports');
      }

      await this.reportStoryRepo.deleteReport(reportId);
      return { 
        statusCode: HttpStatus.NO_CONTENT,
        message: 'Report deleted successfully' 
      };
    } catch (error) {
      throw new NotFoundException('Report not found');
    }
  }

  async getReportsByUser(userId: string, queryDto: QueryReportStoryDto) {
    return this.findAll({ ...queryDto, reporterId: new Types.ObjectId(userId) });
  }

  async getReportsByStory(storyId: string, queryDto: QueryReportStoryDto) {
    return this.findAll({ ...queryDto, targetId: new Types.ObjectId(storyId) });
  }

  async getStatistics() {
    const statistics = await this.reportStoryRepo.getStatistics();
    
    return {
      statusCode: HttpStatus.OK,
      message: 'success',
      data: statistics,
    };
  }
}
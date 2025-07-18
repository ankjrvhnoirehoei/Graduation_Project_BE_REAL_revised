import { Types } from 'mongoose';
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReportContent, ReportContentDocument } from './report-content.schema';
import { CreateReportUserDto } from '../report-user/dto/create-report.dto';

@Injectable()
export class ReportContentService {
  constructor(
    @InjectModel(ReportContent.name)
    private readonly reportModel: Model<ReportContentDocument>,
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
}
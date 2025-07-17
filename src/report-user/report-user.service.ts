import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ReportUser,
  ReportUserDocument,
} from './report-user.schema';
import { CreateReportUserDto } from './dto/create-report-user.dto';

@Injectable()
export class ReportUserService {
  constructor(
    @InjectModel(ReportUser.name)
    private reportUserModel: Model<ReportUserDocument>,
  ) {}

  async create(
    reporterId: string,
    dto: CreateReportUserDto,
  ): Promise<ReportUser> {
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
}
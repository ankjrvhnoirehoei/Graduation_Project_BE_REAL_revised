import { AbstractRepository } from "@app/common";
import { Injectable, Logger } from "@nestjs/common";
import { Model, Types } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";
import { ReportStory as ReportStoryDocument, ReportStatus, ReportReason } from "./schema/report-story.schema";

@Injectable()
export class ReportStoryRepository extends AbstractRepository<ReportStoryDocument> {
  protected readonly logger = new Logger(ReportStoryRepository.name);

  constructor(
    @InjectModel(ReportStoryDocument.name)
    public readonly model: Model<ReportStoryDocument>,
  ) {
    super(model);
  }

  async findAll() {
    return this.find({});
  }

  async createReport(reportDto: any) {
    return this.create({
      ...reportDto,
    });
  }

  async updateReport(reportId: Types.ObjectId, reportDto: any) {
    return this.findOneAndUpdate(
      { _id: reportId },
      {
        ...reportDto,
      }
    );
  }

  async count(query: any = {}) {
    return this.model.countDocuments(query);
  }

  async findByReporter(reporterId: Types.ObjectId) {
    return this.find({
      reporterId,
    });
  }

  async findByTarget(targetId: Types.ObjectId) {
    return this.find({
      targetId,
    });
  }

  async findByStatus(status: ReportStatus) {
    return this.find({
      status,
    });
  }

  async findExistingReport(reporterId: Types.ObjectId, targetId: Types.ObjectId) {
    try {
      return await this.findOne({
        reporterId,
        targetId,
        status: { $ne: ReportStatus.DISMISSED }
      });
    } catch (error) {
      // Return null if not found instead of throwing
      return null;
    }
  }

  async deleteReport(reportId: Types.ObjectId) {
    return this.findOneAndDelete({ _id: reportId });
  }

  async getStatistics() {
    const statusStats = await Promise.all(
      Object.values(ReportStatus).map(async (status) => ({
        _id: status,
        count: await this.model.countDocuments({ status })
      }))
    );

    // Get statistics by reason using Mongoose ORM
    const reasonStats = await Promise.all(
      Object.values(ReportReason).map(async (reason) => ({
        _id: reason,
        count: await this.model.countDocuments({ reason })
      }))
    );

    // Filter out zero counts for cleaner results
    const filteredStatusStats = statusStats.filter(stat => stat.count > 0);
    const filteredReasonStats = reasonStats.filter(stat => stat.count > 0);

    const total = await this.model.countDocuments();

    return {
      byStatus: filteredStatusStats,
      byReason: filteredReasonStats,
      total
    };
  }
}
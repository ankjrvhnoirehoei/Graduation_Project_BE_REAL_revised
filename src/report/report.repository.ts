import { AbstractRepository } from '@app/common';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Report, ReportDocument } from './report.schema';

@Injectable()
export class ReportRepository extends AbstractRepository<ReportDocument> {
    protected readonly logger = new Logger(ReportRepository.name);

    constructor(
        @InjectModel(Report.name) reportModel: Model<ReportDocument>,
    ) {
        super(reportModel);
    }
}
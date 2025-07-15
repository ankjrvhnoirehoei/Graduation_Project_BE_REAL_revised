import { IsArray, IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { AdminAction, ReportStatus } from '../report.schema';

export class BulkResolveReportsDto {
    @IsArray()
    @IsMongoId({ each: true })
    reportIds: string[];

    @IsEnum(ReportStatus)
    status: ReportStatus;

    @IsEnum(AdminAction)
    @IsOptional()
    adminAction?: AdminAction;

    @IsString()
    @IsOptional()
    adminNote?: string;
}
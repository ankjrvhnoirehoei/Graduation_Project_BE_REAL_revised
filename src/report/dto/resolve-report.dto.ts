import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AdminAction, ReportStatus } from '../report.schema';

export class ResolveReportDto {
    @IsEnum(ReportStatus)
    status: ReportStatus;

    @IsEnum(AdminAction)
    @IsOptional()
    adminAction?: AdminAction;

    @IsString()
    @IsOptional()
    adminNote?: string;
}
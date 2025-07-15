import { IsNotEmpty, IsOptional, IsString, IsMongoId, IsEnum } from 'class-validator';
import { ReportReason } from '../report.schema';

export class CreateReportDto {
    @IsMongoId()
    @IsNotEmpty()
    targetId: string;

    @IsEnum(ReportReason)
    @IsNotEmpty()
    reason: ReportReason;

    @IsString()
    @IsOptional()
    description?: string;
}
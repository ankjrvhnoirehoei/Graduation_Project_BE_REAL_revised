import { IsEnum, IsNotEmpty, IsOptional, IsString, IsMongoId } from 'class-validator';
import { ReportTargetType, ReportPriority } from '../report.schema';

export class CreateReportDto {
    @IsEnum(ReportTargetType)
    @IsNotEmpty()
    targetType: ReportTargetType;

    @IsMongoId()
    @IsNotEmpty()
    targetId: string;

    @IsString()
    @IsNotEmpty()
    reason: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsEnum(ReportPriority)
    @IsOptional()
    priority?: ReportPriority;
}
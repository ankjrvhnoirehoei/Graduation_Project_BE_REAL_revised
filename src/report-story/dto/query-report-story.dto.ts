import { IsOptional, IsEnum, IsString, IsNumber, IsDateString, IsMongoId } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Types } from 'mongoose';
import { ReportStatus, ReportPriority } from '../schema/report-story.schema';
import { ReportReason } from 'src/report-content/report-content.schema';

export class QueryReportStoryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportReason)
  reason?: ReportReason;

  @IsOptional()
  @IsEnum(ReportPriority)
  priority?: ReportPriority;

  @IsOptional()
  @IsMongoId()
  reporterId?: Types.ObjectId;

  @IsOptional()
  @IsMongoId()
  targetId?: Types.ObjectId;

  @IsOptional()
  @IsMongoId()
  reviewerId?: Types.ObjectId;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isRead?: boolean;
}
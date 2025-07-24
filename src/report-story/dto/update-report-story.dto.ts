import { IsEnum, IsString, IsOptional, MaxLength, IsMongoId, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { Types } from 'mongoose';
import { ReportStatus, ReportPriority } from '../schema/report-story.schema';

export class UpdateReportStoryDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportPriority)
  priority?: ReportPriority;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  reviewNote?: string;

  @IsOptional()
  @IsMongoId()
  reviewerId?: Types.ObjectId;
}
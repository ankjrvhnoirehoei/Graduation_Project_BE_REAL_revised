import { IsEnum, IsString, IsOptional, MaxLength, IsMongoId, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { Types } from 'mongoose';
import { ReportReason } from 'src/report-content/report-content.schema';

export class CreateReportStoryDto {
  @IsMongoId()
  targetId: Types.ObjectId;

  @IsEnum(ReportReason)
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  description?: string;
}
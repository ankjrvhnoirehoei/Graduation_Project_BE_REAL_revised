import { IsEnum, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportReason } from '../report-user.schema';

export class CreateReportUserDto {
  @IsMongoId()
  targetId: string;

  @IsEnum(ReportReason)
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
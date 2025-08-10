import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetUserReportsDto {
  @IsOptional()
  @IsIn(['resolved', 'ignored'])
  status?: 'resolved' | 'ignored';

  @IsOptional()
  @IsString()
  q?: string; // tìm theo reporter/target username/handleName, reason, description

  @IsOptional()
  @IsString()
  from?: string; // ISO date

  @IsOptional()
  @IsString()
  to?: string; // ISO date

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}

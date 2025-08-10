import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetUserReportsDto {
  @IsOptional()
  @IsIn(['resolved', 'ignored', 'pending'])
  status?: 'resolved' | 'ignored' | 'pending';

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

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

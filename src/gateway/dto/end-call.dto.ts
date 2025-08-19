import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class EndCallDto {
  @IsString()
  roomId: string;

  @IsString()
  userId: string;

  @IsBoolean()
  missed: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  duration?: number;

  @IsIn(['video', 'voice'])
  callType: 'video' | 'voice';

  @IsOptional()
  @IsString()
  callUuid?: string;
}
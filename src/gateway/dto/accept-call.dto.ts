import { IsIn, IsOptional, IsString } from 'class-validator';

export class AcceptCallDto {
  @IsString()
  roomId: string;

  @IsString()
  userId: string;

  @IsIn(['video', 'voice'])
  callType: 'video' | 'voice';

  @IsOptional()
  @IsString()
  callUuid?: string;
}
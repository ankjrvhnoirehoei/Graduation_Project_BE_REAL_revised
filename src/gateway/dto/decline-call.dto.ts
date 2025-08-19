import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class DeclineCallDto {
  @IsMongoId()
  roomId: string;

  @IsMongoId()
  userId: string;

  @IsOptional()
  @IsString()
  callUuid?: string;
}

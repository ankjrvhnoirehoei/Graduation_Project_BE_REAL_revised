import { IsMongoId, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MediaDto {
  @IsString()
  type: 'image' | 'video' | 'audio' | 'file';

  @IsString()
  url: string;
}

export class CreateMessageDto {
  @IsMongoId()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsOptional()
  content?: string;

  @ValidateNested()
  @Type(() => MediaDto)
  @IsOptional()
  media?: MediaDto;
}

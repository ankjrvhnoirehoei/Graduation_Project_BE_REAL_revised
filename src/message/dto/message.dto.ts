import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class MediaDto {
  @IsEnum(['image', 'video', 'audio', 'call'])
  type: 'image' | 'video' | 'audio' | 'call';

  @IsString()
  url: string;

  @IsNumber()
  @IsOptional()
  duration?: number;
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

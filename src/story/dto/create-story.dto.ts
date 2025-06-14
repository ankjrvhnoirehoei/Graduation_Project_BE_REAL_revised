import { IsMongoId, IsOptional, IsString, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class MusicDto {
   @IsMongoId()
   _id: string;

   @IsNumber()
   time_start: number;

   @IsNumber()
   time_end: number;
}

class ContentDto {
   @IsString()
   text: string;

   @IsNumber()
   x: number;

   @IsNumber()
   y: number;
}

export class CreateStoryDto {
   @IsString()
   mediaUrl: string;

   @ValidateNested()
   @Type(() => MusicDto)
   @IsOptional()
   music?: MusicDto;

   @IsOptional()
   @ValidateNested()
   @Type(() => ContentDto)
   content?: ContentDto;
}

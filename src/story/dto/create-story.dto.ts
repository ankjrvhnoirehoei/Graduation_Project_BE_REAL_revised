import { IsMongoId, IsOptional, IsString, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';

class MusicDto {
   @IsMongoId({ message: 'musicId must be a valid Mongo ID' })
   _id: Types.ObjectId;

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

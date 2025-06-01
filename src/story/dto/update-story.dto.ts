import { PartialType } from '@nestjs/mapped-types';
import { CreateStoryDto } from './create-story.dto';
import { IsAlpha, IsNotEmpty, IsString } from 'class-validator';

export class UpdateStoryDto {
   @IsString()
   @IsNotEmpty()
   _id: string;

   @IsString()
   @IsNotEmpty()
   viewerId: string;
}

import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateStoryDto {
   @IsString()
   @IsNotEmpty()
   _id: string;
}

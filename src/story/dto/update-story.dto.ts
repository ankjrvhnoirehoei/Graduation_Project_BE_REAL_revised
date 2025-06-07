import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateStoryDto {
   @IsString()
   @IsNotEmpty({message: 'Story_id is required'})
   _id: string;
}

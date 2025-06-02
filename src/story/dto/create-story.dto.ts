import { IsNotEmpty, IsString } from "class-validator";

export class CreateStoryDto {
   @IsString()
   userId: string;

   @IsString()
   @IsNotEmpty()
   mediaUrl: string;
}

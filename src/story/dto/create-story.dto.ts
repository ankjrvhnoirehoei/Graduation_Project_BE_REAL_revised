import { IsNotEmpty, IsString } from "class-validator";

export class CreateStoryDto {
   @IsString()
   @IsNotEmpty()
   mediaUrl: string;

   @IsString()
   @IsNotEmpty()
   musicId: string;
}

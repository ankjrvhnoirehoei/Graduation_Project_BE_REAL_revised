import { IsNotEmpty, IsString } from "class-validator";

export class CreateStoryDto {
   @IsString()
   @IsNotEmpty()
   mediaUrl: string;

   @IsString()
   musicId: string;
}

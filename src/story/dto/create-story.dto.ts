import { Type } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";
import { Types } from "mongoose";

export class CreateStoryDto {
   @IsString()
   userId: string;

   @IsString()
   @IsNotEmpty()
   mediaUrl: string;
}

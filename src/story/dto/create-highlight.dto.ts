import { IsArray, IsNotEmpty, IsString } from "class-validator";

export class CreateHighlightStoryDto {
   @IsString()
   @IsNotEmpty()
   userId: string;

   @IsString()
   @IsNotEmpty()
   collectionName: string

   @IsArray()
   @IsNotEmpty()
   storyId: string[]
}

import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsString } from "class-validator";

export class CreateHighlightStoryDto {
   @IsString()
   @IsNotEmpty()
   @Type(() => String)
   collectionName: string

   @IsString()
   @IsNotEmpty()
   thumbnail: string

   @IsArray()
   @IsNotEmpty()
   storyId: string[]
}

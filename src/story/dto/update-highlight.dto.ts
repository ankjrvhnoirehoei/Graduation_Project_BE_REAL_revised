import { IsArray, IsMongoId, IsNotEmpty, IsOptional } from "class-validator";

export class UpdateHighlightDto {
  @IsMongoId()
  @IsNotEmpty()
  _id: string;
  
  @IsNotEmpty()
  @IsArray()
  storyId: string[];

  @IsOptional()
  collectionName?: string;
}
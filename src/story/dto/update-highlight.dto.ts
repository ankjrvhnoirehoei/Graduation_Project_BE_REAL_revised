import { IsArray, IsMongoId, IsNotEmpty, IsOptional } from "class-validator";

export class UpdateHighlightDto {
  @IsMongoId()
  @IsNotEmpty()
  _id: string;
  
  @IsOptional()
  @IsArray()
  storyId?: string[];
  @IsOptional()
  collectionName?: string;
  @IsOptional()
  thumbnail?: string
}
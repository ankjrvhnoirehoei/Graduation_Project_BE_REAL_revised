import { Type } from "class-transformer";
import { IsMongoId, IsNotEmpty, IsString } from "class-validator";

export class CreateHighlightDto {
  @IsMongoId()
  storyId: string[];

  @IsMongoId()
  @IsNotEmpty({message: 'Missing userId out'})
  userId: string;

  @IsString()
  @IsNotEmpty ({
    message: 'Missing highlight story collection name out'
  })
  @Type(() => String)
  collectionName: string;
}
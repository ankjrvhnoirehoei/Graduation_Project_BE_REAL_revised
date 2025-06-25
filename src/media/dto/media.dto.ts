import {
  IsMongoId,
  IsOptional,
  IsString,
  IsNumber,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

class TagDto {
  @IsMongoId()
  userId: string;

  @IsString()
  handleName: string;

  @IsNumber()
  positionX: number;

  @IsNumber()
  positionY: number;
}

export class CreateMediaDto {
  @IsMongoId()
  postID: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TagDto)
  tags?: TagDto[];
}

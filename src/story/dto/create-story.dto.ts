import {
  IsMongoId,
  IsOptional,
  IsString,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

class MusicDto {
  @IsMongoId({ message: 'musicId must be a valid Mongo ID' })
  _id: string;

  @IsNumber({}, { message: 'time_start should be number' })
  time_start: number;

  @IsNumber({}, { message: 'time_end should be number' })
  time_end: number;
}

class ContentDto {
  @IsString()
  text: string;

  @IsNumber({}, { message: 'x should be number' })
  x: number;

  @IsNumber({}, { message: 'y should be number' })
  y: number;
}

class TagPosition {
  @IsNumber({}, { message: 'x should be number' })
  x: number;

  @IsNumber({}, { message: 'y should be number' })
  y: number;
}

class TagUserDto {
  @IsMongoId({ message: 'user must be a valid Mongo ID' })
  user: string;

  @ValidateNested()
  @Type(() => TagPosition)
  position: TagPosition;
}

export class CreateStoryDto {
  @IsString()
  mediaUrl: string;

  @ValidateNested()
  @Type(() => MusicDto)
  @IsOptional()
  music?: MusicDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContentDto)
  content?: ContentDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TagUserDto)
  tags?: TagUserDto[];
}

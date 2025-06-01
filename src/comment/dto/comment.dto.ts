import { IsMongoId, IsOptional, IsString, IsBoolean, MinLength } from 'class-validator';

export class CommentDto {
  @IsMongoId()
  postID: string;

  @IsOptional()
  @IsMongoId()
  parentID?: string;

  @IsString()
  @MinLength(1)
  content: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;
}
import { IsMongoId, IsOptional, IsString, IsBoolean, MinLength } from 'class-validator';

export class CommentDto {
  @IsMongoId()
  readonly postID: string;

  @IsOptional()
  @IsMongoId()
  readonly parentID?: string;

  @IsString()
  @MinLength(1)
  readonly content: string;

  @IsOptional()
  @IsString()
  readonly mediaUrl?: string;

  @IsOptional()
  @IsBoolean()
  readonly isDeleted?: boolean;
}
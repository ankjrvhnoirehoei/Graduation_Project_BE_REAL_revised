import { IsMongoId, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CommentDto {
  @IsMongoId()
  readonly userID: string;

  @IsMongoId()
  readonly postID: string;

  @IsOptional()
  @IsMongoId()
  readonly parentID?: string;

  @IsString()
  readonly content: string;

  @IsOptional()
  readonly mediaUrl?: string;

  @IsOptional()
  @IsBoolean()
  readonly isDeleted?: boolean;
}
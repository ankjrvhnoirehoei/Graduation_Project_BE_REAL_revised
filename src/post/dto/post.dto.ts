import { IsBoolean, IsMongoId, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePostDto {
  @IsMongoId()
  userID: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsBoolean()
  isFlagged?: boolean;

  @IsOptional()
  @IsBoolean()
  nsfw?: boolean;

  @IsBoolean()
  isEnable: boolean;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @IsNumber()
  viewCount?: number;

  @IsOptional()
  @IsNumber()
  share?: number;
}

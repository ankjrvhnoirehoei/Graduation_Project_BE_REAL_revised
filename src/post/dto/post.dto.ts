import { IsMongoId } from 'class-validator';

export class CreatePostDto {
  @IsMongoId()
  userID: string;

  @IsMongoId()
  musicID?: string;

  type: string;
  caption?: string;
  isFlagged?: boolean;
  nsfw?: boolean;
  isEnable: boolean;
  location?: string;
  isArchived?: string;
  viewCount?: number;
  share?: number;
}

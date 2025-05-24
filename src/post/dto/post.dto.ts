import { IsMongoId } from "class-validator";

export class CreatePostDto {
  @IsMongoId()
  readonly userID: string;
  
  readonly type: string;
  readonly caption?: string;
  readonly isFlagged?: boolean;
  readonly nsfw?: boolean;
  readonly isEnable: boolean;
  readonly location?: string;
  readonly isArchived?: string;
  readonly viewCount: number;
  readonly share?: number;
}

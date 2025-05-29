import { IsMongoId } from 'class-validator';

export class PostLikeDto {
  @IsMongoId()
  videoId: string;
}
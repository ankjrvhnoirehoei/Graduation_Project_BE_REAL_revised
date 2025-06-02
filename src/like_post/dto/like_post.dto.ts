import { IsMongoId } from 'class-validator';

export class CreatePostLikeDto {
  @IsMongoId()
  postId: string;
}
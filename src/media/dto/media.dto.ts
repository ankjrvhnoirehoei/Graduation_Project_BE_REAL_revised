import { IsMongoId } from 'class-validator';

export class CreateMediaDto {
  @IsMongoId()
  postID: string;

  imageUrl?: string;
  videoUrl?: string;
}

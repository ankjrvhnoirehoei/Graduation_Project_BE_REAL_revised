import { IsMongoId } from 'class-validator';

export class CreateMediaDto {
  @IsMongoId()
  readonly postID: string;

  readonly imageUrl?: string;
  readonly videoUrl?: string;
}

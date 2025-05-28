import { IsMongoId } from 'class-validator';

export class CreateMediaDto {
  @IsMongoId()
  readonly postID: string;

  @IsMongoId()
  readonly musicID?: string;

  readonly imageUrl?: string;
  readonly videoUrl?: string;
}

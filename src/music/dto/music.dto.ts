import { IsMongoId } from 'class-validator';

export class MusicDto {
  @IsMongoId()
  readonly postID?: string;

  readonly song: string;
  readonly link: string;
  readonly author: string;
  readonly coverImg: string;
}

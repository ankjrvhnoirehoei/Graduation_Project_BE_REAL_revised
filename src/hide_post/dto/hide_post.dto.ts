import { IsMongoId } from 'class-validator';

export class HidePostParamsDto {
  @IsMongoId()
  postId: string;
}

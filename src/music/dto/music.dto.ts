import { IsMongoId, IsNumber } from 'class-validator';
import { Types } from 'mongoose';

export class MusicDto {
  song: string;
  link: string;
  author: string;
  coverImg: string;
}

export class MusicPostDto {
  @IsMongoId()
  musicId: string;

  @IsNumber()
  timeStart: number;

  @IsNumber()
  timeEnd: number;
}

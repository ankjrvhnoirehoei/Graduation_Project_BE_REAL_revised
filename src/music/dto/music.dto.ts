import { Types } from 'mongoose';

export class MusicDto {
  song: string;
  link: string;
  author: string;
  coverImg: string;
}

export interface MusicPostDto {
  musicId: Types.ObjectId;
  timeStart: number;
  timeEnd: number;
}

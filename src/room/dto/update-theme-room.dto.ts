import { IsString } from 'class-validator';

export class UpdateThemeRoomDto {
  @IsString()
  theme: string;
}
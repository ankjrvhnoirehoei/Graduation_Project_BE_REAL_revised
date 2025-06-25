import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateRoomNameDto {
  @IsNotEmpty()
  @IsString()
  name: string;
}
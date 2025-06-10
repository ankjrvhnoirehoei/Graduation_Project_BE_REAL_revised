import { IsArray, ArrayMinSize, ArrayMaxSize, ArrayNotEmpty, IsMongoId } from 'class-validator';

export class CreateRoomDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  // for single-chat, length === 1; for group, length >= 2
  userIds: string[];
}
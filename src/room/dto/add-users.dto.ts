import { IsArray, ArrayNotEmpty, IsMongoId } from 'class-validator';

export class AddUsersDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  user_ids: string[];
}
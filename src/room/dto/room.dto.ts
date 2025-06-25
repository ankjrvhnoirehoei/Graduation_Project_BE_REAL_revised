import { IsNotEmpty, IsMongoId, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateRoomDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  user_ids?: string[];
}

export class AddUserToRoomDto {
  @IsNotEmpty()
  @IsMongoId()
  user_id: string;
}

import { IsNotEmpty, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateRoomDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  type: string;

  @IsNotEmpty()
  @IsMongoId()
  create_by: string;

  @IsOptional()
  @IsString()
  theme?: string;
}

export class AddUserToRoomDto {
  @IsNotEmpty()
  @IsMongoId()
  user_id: string;
}

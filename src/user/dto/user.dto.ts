import {
  IsEmail,
  IsOptional,
  IsString,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';

export class UserDto {
  @IsString()
  username: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsString()
  handleName: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  profilePic?: string;

  @IsOptional()
  dateOfBirth?: string;

  @IsBoolean()
  isVip: boolean;

  @IsString()
  refreshToken?: string;

  @IsString()
  fcmToken?: string;

  @IsOptional()
  @IsBoolean()
  deletedAt?: boolean;
}

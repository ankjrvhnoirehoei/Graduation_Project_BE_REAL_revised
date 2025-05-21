import { IsEmail, IsOptional, IsString, IsBoolean } from 'class-validator';

export class UserDto {
  @IsString()
  readonly username: string;

  @IsOptional()
  @IsEmail()
  readonly email: string;

  @IsString()
  readonly password: string;

  @IsOptional()
  @IsString()
  readonly phoneNumber?: string;

  @IsString()
  readonly handleName: string;

  @IsOptional()
  @IsString()
  readonly bio?: string;

  @IsOptional()
  @IsString()
  readonly address?: string;

  @IsOptional()
  @IsString()
  readonly gender?: string;

  @IsOptional()
  readonly profilePic?: string;

  @IsBoolean()
  readonly isVip: boolean;

  @IsString()
  readonly refreshToken?: string;

  @IsOptional()
  @IsBoolean()
  readonly deletedAt?: boolean;
}

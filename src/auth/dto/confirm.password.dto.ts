import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class ConfirmForgotDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @IsString()
  @Length(6, 6, { message: 'Confirmation code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Confirmation code must consist of digits only' })
  code: string;
}
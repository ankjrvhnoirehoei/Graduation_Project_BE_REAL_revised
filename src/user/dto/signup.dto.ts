import {
  IsEmail,
  IsString,
  MinLength,
  Matches
} from 'class-validator';

export class SignupDto {
  @IsString()
  readonly username: string;

  @IsEmail()
  readonly email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  // at least one uppercase, one number, one special character
  @Matches(/(?=.*[A-Z])(?=.*\d)(?=.*\W)/,
    { message: 'Password too weak; include uppercase, number, and special char' }
  )
  readonly password: string;
}

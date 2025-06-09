import {
  IsOptional,
  IsString,
  IsNotEmpty,
  MaxLength,
  Matches,
  IsIn,
  Validate,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
  IsEmail,
  Length,
  MinLength,
} from 'class-validator';

// custom validator to enforce a max word count
function MaxWords(maxWords: number, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'maxWords',
      target: object.constructor,
      propertyName,
      constraints: [maxWords],
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          const words = value.trim().split(/\s+/).filter(Boolean);
          return words.length <= maxWords;
        },
        defaultMessage(args: ValidationArguments) {
          const [limit] = args.constraints;
          return `${args.property} can have at most ${limit} words`;
        },
      },
    });
  };
}

export class EditUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'username must not be empty' })
  username?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]+$/, {
    message: 'phoneNumber must contain only digits',
  })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxWords(2000, { message: 'bio must be 2000 words or fewer' })
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxWords(200, { message: 'address must be 200 words or fewer' })
  address?: string;

  @IsOptional()
  @IsString()
  @IsIn(['male', 'female', 'undisclosed'], {
    message: 'gender must be one of male, female, undisclosed',
  })
  gender?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @Matches(/(?=.*\d)/, {
    message: 'Password must contain at least one number',
  })
  @Matches(/(?=.*[a-z])/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/(?=.*[A-Z])/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/(?=.*[\W_])/, {
    message: 'Password must contain at least one special character',
  })
  password?: string;
}

export class ChangeEmailDto {
  @IsEmail({}, { message: 'Must be a valid email address' })
  email: string;
}

export class ConfirmEmailDto {
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  token: string;

  @IsString()
  @Length(6, 6, { message: 'Confirmation code must be 6 characters' })
  code: string;
}

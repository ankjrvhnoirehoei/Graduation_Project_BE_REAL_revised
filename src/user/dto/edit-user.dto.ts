import {
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  Validate,
} from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

// word-count validator for bio 
function MaxWords(max: number, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'maxWords',
      target: object.constructor,
      propertyName,
      constraints: [max],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          const count = value.trim().split(/\s+/).filter(Boolean).length;
          return count <= args.constraints[0];
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must not exceed ${args.constraints[0]} words`;
        },
      },
    });
  };
}

export class EditUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'Username must be at most 30 characters' })
  username?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\- ]{6,20}$/, {
    message: 'Phone number must be digits, spaces or +/-, and 6-20 chars',
  })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'Handle name must be at most 30 characters' })
  handleName?: string;

  @IsOptional()
  @IsString()
  @MaxWords(400, { message: 'Bio can be no longer than 400 words' })
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Address must be at most 200 characters' })
  address?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(male|female|undisclosed)$/, {
    message: 'Gender must be one of: male, female, undisclosed',
  })
  gender?: string;
}

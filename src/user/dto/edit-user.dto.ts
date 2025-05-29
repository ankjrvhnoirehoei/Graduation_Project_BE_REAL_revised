import {
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  Validate,
  MinLength,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidateIf,
} from 'class-validator';
import { BadRequestException } from '@nestjs/common';

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

function Match(property: string, validationOptions?: ValidationOptions) {
  return (object: Object, propertyName: string) => {
    registerDecorator({
      name: 'match',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];
          return value === relatedValue;
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          return `${args.property} must match ${relatedPropertyName}`;
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

  @ValidateIf(o => o.currentPassword != null || o.newPassword != null || o.confirmPassword != null)
  @IsString()
  @MinLength(8, { message: 'Current password must be at least 8 characters' })
  currentPassword?: string;

  @ValidateIf(o => o.currentPassword != null || o.newPassword != null || o.confirmPassword != null)
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @Matches(/(?=.*[A-Za-z])(?=.*\d).+/, {
    message: 'New password must contain letters and numbers',
  })
  newPassword?: string;

  @ValidateIf(o => o.currentPassword != null || o.newPassword != null || o.confirmPassword != null)
  @IsString()
  @Match('newPassword', { message: 'Confirm password must match new password' })
  confirmPassword?: string;
}

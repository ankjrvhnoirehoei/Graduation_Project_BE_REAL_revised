import { Type } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";
import { string } from "joi";

export class CreateStoryDto {
  @IsNotEmpty()
  @IsString()
  @Type(() => string)
  userId: string;

  @IsString()
  @IsNotEmpty()
  @Type(() => string)
  mediaUrl: string; 
  // @IsString()
  // @IsNotEmpty()
  // userId: String;

  // @IsNumber()
  // @Type(() => Number)
  // viewsCount: Number;

  // @IsBoolean()
  // @Type(() => Boolean)
  // isArchived: Boolean;

  // @IsDate()
  // @Type(() =>  Date)
  // createdAt: Date;
}

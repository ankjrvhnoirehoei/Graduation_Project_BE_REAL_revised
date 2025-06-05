import { IsString, MinLength } from 'class-validator';

export class SearchDto {
  @IsString()
  @MinLength(1)
  keyword: string;
}

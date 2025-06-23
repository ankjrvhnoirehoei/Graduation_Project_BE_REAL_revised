import { IsString, MinLength, IsIn } from 'class-validator';

export class SearchUserDto {
  @IsString()
  @MinLength(1)
  keyword: string;

  @IsString()
  @IsIn(['username', 'handleName'])
  mode: 'username' | 'handleName';
}

export interface InteractionPoint {
  day: number;
  count: number;
}
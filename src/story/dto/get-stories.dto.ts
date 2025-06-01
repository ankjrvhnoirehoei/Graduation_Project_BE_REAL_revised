import { IsArray, IsString } from 'class-validator';

export class GetStoriesByIdsDto {
  @IsArray()
  @IsString({ each: true })
  storyIds: string[];
}
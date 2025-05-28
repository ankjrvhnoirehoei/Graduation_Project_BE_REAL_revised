import { IsMongoId } from 'class-validator';

export class GetFollowersDto {
  @IsMongoId({ message: 'userId must be a valid Mongo ID' })
  userId: string;
}
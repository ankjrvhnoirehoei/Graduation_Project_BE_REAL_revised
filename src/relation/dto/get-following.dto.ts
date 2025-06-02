import { IsMongoId } from 'class-validator';

export class GetFollowingDto {
  @IsMongoId({ message: 'userId must be a valid Mongo ID' })
  userId: string;
}
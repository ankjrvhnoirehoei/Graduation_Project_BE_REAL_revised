import { IsMongoId } from 'class-validator';

export class GetBlockingDto {
  @IsMongoId({ message: 'userId must be a valid Mongo ID' })
  userId: string;
}
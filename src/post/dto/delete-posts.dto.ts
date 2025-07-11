import { IsArray, ArrayNotEmpty, IsMongoId } from 'class-validator';

export class DeletePostsDto {
@IsArray()
@ArrayNotEmpty()
@IsMongoId({ each: true })
postIds: string[];
}
import { IsIn, IsMongoId, IsString } from 'class-validator';

export class UpsertRelationDto {
  @IsMongoId({ message: 'targetId must be a valid user ObjectId' })
  targetId: string;

  @IsIn(['follow', 'unfollow', 'block', 'unblock'], {
    message: 'action must be one of follow, unfollow, block, unblock',
  })
  action: 'follow' | 'unfollow' | 'block' | 'unblock';
}
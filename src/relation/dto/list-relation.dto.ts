import { IsIn } from 'class-validator';

export class ListRelationDto {
  @IsIn(['followers', 'following', 'blockers', 'blocking'], {
    message: 'filter must be one of followers, following, blockers, blocking',
  })
  filter: 'followers' | 'following' | 'blockers' | 'blocking';
}

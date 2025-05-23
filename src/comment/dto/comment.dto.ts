export class CommentDto {
  readonly userID: string;
  readonly postID: string;
  readonly parentID?: string;
  readonly content: string;
  readonly mediaUrl?: string;
  readonly isDeleted: boolean;
}

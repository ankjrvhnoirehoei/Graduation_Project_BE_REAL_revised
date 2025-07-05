import { Expose, Type } from 'class-transformer';

export class UserCommentDto {
  @Expose()
  _id: string;

  @Expose()
  handleName: string;

  @Expose()
  profilePic?: string;
}

export class CommentResponseDto {
  @Expose()
  _id: string;

  @Expose()
  postID: string;

  @Expose()
  parentID: string | null;

  @Expose()
  content: string;

  @Expose()
  mediaUrl?: string;

  @Expose()
  isDeleted: boolean;

  @Expose()
  likedBy: string[];

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  userID: string;
}

export class CreateCommentResponse {
  @Type(() => CommentResponseDto)
  @Expose()
  comment: CommentResponseDto;

  @Type(() => UserCommentDto)
  @Expose()
  user: UserCommentDto;
}

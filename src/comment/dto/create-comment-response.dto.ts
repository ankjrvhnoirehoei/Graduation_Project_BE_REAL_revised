import { Expose, Type, Transform } from 'class-transformer';
import { Types } from 'mongoose';

export class UserLite {
  @Expose() @Transform(({ value }) => value.toString()) _id: string;
  @Expose() handleName: string;
  @Expose() profilePic: string;
}

export class CommentFull {
  /* ObjectId → string cho tiện front-end */
  @Expose({ name: '_id' })        @Transform(({ value }) => value.toString()) id: string;
  @Expose()                       @Transform(({ value }) => value.toString()) userID: string;
  @Expose()                       @Transform(({ value }) => value.toString()) postID: string;
  @Expose()                       @Transform(({ value }) => value?.toString()) parentID?: string;

  @Expose() content?: string;
  @Expose() mediaUrl?: string;
  @Expose() isDeleted: boolean;
  @Expose()                       @Transform(({ value }) => value.map((x: Types.ObjectId) => x.toString()))
  likedBy: string[];

  /* timestamps được Mongoose thêm tự động */
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
}

export class CreateCommentResponse {
  @Expose() @Type(() => CommentFull) comment: CommentFull;
  @Expose() @Type(() => UserLite)    user: UserLite;
}
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment } from './comment.schema';
import { CommentDto } from './dto/comment.dto';

@Injectable()
export class CommentService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<Comment>,
  ) {}

  async createComment(dto: CommentDto, userID: string): Promise<Comment> {
    const comment = new this.commentModel({
      userID: userID,
      postID: dto.postID,
      parentID: dto.parentID ? new Types.ObjectId(dto.parentID) : null,
      content: dto.content,
      mediaUrl: dto.mediaUrl,
      isDeleted: dto.isDeleted ?? false,
    });
    return comment.save();
  }

  async getCommentsByPost(postID: string): Promise<any[]> {
    const allComments = await this.commentModel.aggregate([
      { $match: { postID: new Types.ObjectId(postID) } },

      {
        $lookup: {
          from: 'users',
          localField: 'userID',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },

      {
        $facet: {
          rootComments: [
            { $match: { parentID: null } },
            {
              $project: {
                _id: 1,
                content: 1,
                mediaUrl: 1,
                isDeleted: 1,
                likedBy: 1,
                postID: 1,
                createdAt: 1,
                user: {
                  _id: '$user._id',
                  handleName: '$user.handleName',
                  profilePic: '$user.profilePic',
                },
              },
            },
          ],
          replies: [
            { $match: { parentID: { $ne: null } } },
            { $sort: { createdAt: -1 } },
            {
              $lookup: {
                from: 'users',
                localField: 'userID',
                foreignField: '_id',
                as: 'user',
              },
            },
            { $unwind: '$user' },
            {
              $project: {
                _id: 1,
                parentID: 1,
                content: 1,
                mediaUrl: 1,
                isDeleted: 1,
                likedBy: 1,
                createdAt: 1,
                user: {
                  _id: '$user._id',
                  handleName: '$user.handleName',
                  profilePic: '$user.profilePic',
                },
              },
            },
          ],
        },
      },
    ]);

    const { rootComments, replies } = allComments[0];

    const result = rootComments.map((comment: any) => {
      const replyList = replies
        .filter(
          (reply: any) => reply.parentID.toString() === comment._id.toString(),
        )
        .slice(0, 4);

      return {
        ...comment,
        reply: replyList,
      };
    });

    return result;
  }
}
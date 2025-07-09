import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment } from './comment.schema';
import { CommentDto } from './dto/comment.dto';
import { plainToInstance } from 'class-transformer';
import { CreateCommentResponse } from './dto/commentRes.dto';
import { User } from '../user/user.schema';

@Injectable()
export class CommentService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<Comment>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async createComment(
    dto: CommentDto,
    userID: string,
  ): Promise<CreateCommentResponse> {
    const comment = new this.commentModel({
      userID: new Types.ObjectId(userID),
      postID: new Types.ObjectId(dto.postID),
      parentID: dto.parentID ? new Types.ObjectId(dto.parentID) : null,
      content: dto.content,
      mediaUrl: dto.mediaUrl,
      isDeleted: dto.isDeleted ?? false,
    });

    const savedComment = await comment.save();

    const user = await this.userModel
      .findById(userID)
      .select('_id handleName profilePic')
      .lean();

    if (!user) {
      throw new NotFoundException('Không tìm thấy User');
    }

    const result = {
      comment: {
        ...savedComment.toObject(),
        userID: userID.toString(),
      },
      user: user,
    };

    return plainToInstance(CreateCommentResponse, result, {
      excludeExtraneousValues: true,
    });
  }

  async getCommentsByPost(
    postID: string,
    currentUserId: string,
  ): Promise<any[]> {
    const allComments = await this.commentModel.aggregate([
      { $match: { postID: new Types.ObjectId(postID) } },

      // join user for root & replies
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
      // build replies list
      const replyList = replies
        .filter((r: any) => r.parentID.toString() === comment._id.toString())
        .slice(0, 4)
        .map((r: any) => {
          const { likedBy, ...restReply } = r;
          return {
            ...restReply,
            totalLikes: likedBy.length,
            isLiked: likedBy.some(
              (id: Types.ObjectId) => id.toString() === currentUserId,
            ),
          };
        });

      // strip out likedBy from root comment
      const { likedBy, ...restComment } = comment;
      return {
        ...restComment,
        totalLikes: likedBy.length,
        isLiked: likedBy.some(
          (id: Types.ObjectId) => id.toString() === currentUserId,
        ),
        reply: replyList,
      };
    });

    return result;
  }

  async findByPostId(postID: string): Promise<Comment[]> {
    return this.commentModel.find({ postID: postID }).exec();
  }

  async getCommentCount(postID: string): Promise<number> {
    return await this.commentModel
      .countDocuments({
        postID: new Types.ObjectId(postID),
        isDeleted: false,
      })
      .lean();
  }

  async likeComment(commentId: string, userId: string): Promise<any> {
    return this.commentModel.updateOne(
      { _id: new Types.ObjectId(commentId) },
      { $addToSet: { likedBy: new Types.ObjectId(userId) } },
    );
  }

  async unlikeComment(commentId: string, userId: string): Promise<any> {
    return this.commentModel.updateOne(
      { _id: new Types.ObjectId(commentId) },
      { $pull: { likedBy: new Types.ObjectId(userId) } },
    );
  }
}

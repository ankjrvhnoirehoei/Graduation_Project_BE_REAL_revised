import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment } from './comment.schema';
import { CommentDto } from './dto/comment.dto';
import { NotificationService } from 'src/notification/notification.service';
import { Post, PostDocument } from 'src/post/post.schema';

@Injectable()
export class CommentService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<Comment>,
    private readonly notificationService: NotificationService,
    @InjectModel(Post.name)    private postModel:    Model<PostDocument>, 
  ) {}

  async createComment(dto: CommentDto, userID: string): Promise<Comment> {
    const saved = await new this.commentModel({
      userID:   new Types.ObjectId(userID),
      postID:   new Types.ObjectId(dto.postID),
      parentID: dto.parentID ? new Types.ObjectId(dto.parentID) : undefined,
      content:  dto.content,
      mediaUrl: dto.mediaUrl,
      isDeleted: dto.isDeleted ?? false,
    }).save();

    // Determine recipient
    let recipientId: string;
    let isReply = false;

    if (dto.parentID) {
      // reply will look up the *owner* of the parent comment
      const parent = await this.commentModel
        .findById(dto.parentID)
        .select('userID')
        .lean();
      if (!parent) throw new NotFoundException('Bình luận gốc không tồn tại');
      recipientId = parent.userID.toString();
      isReply = true;
    } else {
      // post owner
      const post = await this.postModel
        .findById(dto.postID)
        .select('userID')
        .lean();
      if (!post) throw new NotFoundException('Bài viết không tồn tại');
      recipientId = post.userID.toString();
    }

    // Skip if user is acting on their own content
    if (recipientId === userID) return saved;

    // Fire notification
    if (isReply) {
      await this.notificationService.notifyReply(
        userID,
        recipientId,
        dto.postID,
      );
    } else {
      await this.notificationService.notifyComment(
        userID,
        recipientId,
        dto.postID,
      );
    }

    return saved;
  }

  async getCommentsByPost(postID: string, currentUserId: string): Promise<any[]> {
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
            isLiked: likedBy.some((id: Types.ObjectId) => id.toString() === currentUserId),
          };
        });

      // strip out likedBy from root comment
      const { likedBy, ...restComment } = comment;
      return {
        ...restComment,
        totalLikes: likedBy.length,
        isLiked: likedBy.some((id: Types.ObjectId) => id.toString() === currentUserId),
        reply: replyList,
      };
    });

    return result;
  }

  async findByPostId(postID: string): Promise<Comment[]> {
    return this.commentModel.find({ postID: postID }).exec();
  }    
}
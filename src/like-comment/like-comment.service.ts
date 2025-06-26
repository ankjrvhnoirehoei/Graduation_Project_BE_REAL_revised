import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CommentLike, CommentLikeDocument } from './like-comment.schema';
import { Comment, CommentDocument } from 'src/comment/comment.schema';
import { User, UserDocument } from 'src/user/user.schema';
import { RelationService } from 'src/relation/relation.service';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class LikeCommentService {
  constructor(
    @InjectModel(CommentLike.name)
    private commentLikeModel: Model<CommentLikeDocument>,
    @InjectModel(Comment.name)
    private commentModel: Model<CommentDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private readonly relationService: RelationService,
    private readonly notificationService: NotificationService,
  ) {}

  // Toggle like/unlike for a comment.
  async toggleLike(commentId: string, userId: string): Promise<{ liked: boolean }> {
    // Ensure comment exists
    const comment = await this.commentModel.findById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Determine whether we're unliking or liking
    const hasLiked = comment.likedBy.some(id => id.toString() === userId);

    if (hasLiked) {
      // unlike 
      comment.likedBy = comment.likedBy.filter(id => id.toString() !== userId);
      await comment.save();
      await this.commentLikeModel.deleteOne({ commentId, userId });
      // No notifications on unlike
      const parent = await this.commentModel
        .findById(commentId)
        .select('userID postID')
        .lean();
      if (parent) {
        const commentOwnerId = parent.userID.toString();
        const postId         = parent.postID.toString();

      await this.notificationService.retractCommentLike(
        userId,
        commentOwnerId,
        postId,
        commentId,
      );
    }

  return { liked: false };

    } else {
      // like  
      comment.likedBy.push(new Types.ObjectId(userId));
      await comment.save();
      await this.commentLikeModel.create({ commentId, userId });

      // Fire notification, but only once ever and not for self-likes
      const parent = await this.commentModel
        .findById(commentId)
        .select('userID postID')
        .lean();
      if (!parent) {
        throw new NotFoundException('Comment not found');
      }

      const commentOwnerId = parent.userID.toString();
      const postId         = parent.postID.toString();

      // Skip notifying if you liked your own comment
      if (commentOwnerId !== userId) {
        await this.notificationService.notifyCommentLike(
          userId,
          commentOwnerId,
          postId,
          commentId,
        );
      }

      return { liked: true };
    }
  }

  // Retrieve all likers of a comment, enriched with follow/block status.
  async getCommentLikers(commentId: string, currentUserId: string) {
    const likes = await this.commentLikeModel.find({ commentId }).select('userId').lean();
    const userIds = likes.map(like => like.userId.toString());

    const users = await this.userModel
      .find({ _id: { $in: userIds } })
      .select('username handleName profilePic')
      .lean();

    const enriched = await Promise.all(
      users.map(async user => {
        const targetId = user._id.toString();
        if (targetId === currentUserId) {
          return { userId: targetId, username: user.username, handleName: user.handleName, profilePic: user.profilePic || '', isCurrentUser: true };
        }
        const { relation, userOneIsActing } = await this.relationService.getRelation(currentUserId, targetId);
        if (relation) {
          const [one, two] = relation.split('_');
          // block check
          if ((userOneIsActing ? one === 'BLOCK' || two === 'BLOCK' : two === 'BLOCK' || one === 'BLOCK')) {
            return null;
          }
          const userFollowing = userOneIsActing ? one === 'FOLLOW' : two === 'FOLLOW';
          return { userId: targetId, username: user.username, handleName: user.handleName, profilePic: user.profilePic || '', userFollowing, isCurrentUser: false };
        }
        return { userId: targetId, username: user.username, handleName: user.handleName, profilePic: user.profilePic || '', userFollowing: false, isCurrentUser: false };
      })
    );

    const filtered = enriched.filter(u => u !== null);
    return filtered
      .sort((a, b) => (a.isCurrentUser ? -1 : b.isCurrentUser ? 1 : 0))
      .map(({ isCurrentUser, ...rest }) => rest);
  }
}
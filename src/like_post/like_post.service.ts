import { Injectable, ConflictException, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PostLike, PostLikeDocument } from './like_post.schema';
import { Post, PostDocument } from 'src/post/post.schema';
import { User, UserDocument } from 'src/user/user.schema'; 
import { RelationService } from 'src/relation/relation.service';
import { PostService } from 'src/post/post.service';

export enum TimeRange {
  TODAY = 'today',
  LAST_WEEK = 'last_week',
  LAST_MONTH = 'last_month',
  LAST_YEAR = 'last_year'
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}
@Injectable()
export class PostLikeService {
  constructor(
    @InjectModel(PostLike.name)
    private postLikeModel: Model<PostLikeDocument>,
    @InjectModel(Post.name)
    private postModel: Model<PostDocument>,
    @InjectModel(User.name)  
    private userModel: Model<UserDocument>, 
    private readonly relationService: RelationService,

    @Inject(forwardRef(() => PostService))
    private readonly postService: PostService,
  ) {}

  async like(postId: string, userId: string): Promise<void> {
    const existing = await this.postLikeModel.findOne({ postId, userId });
    if (existing) {
      throw new ConflictException('User has already liked this post');
    }
    await this.postLikeModel.create({ postId, userId });
  }

  async unlike(postId: string, userId: string): Promise<void> {
    await this.postLikeModel.deleteOne({ postId, userId });
  }
  
  private getVietnameseTimeBounds(timeRange: TimeRange): { start: Date; end: Date } {
    // Get current time in Vietnamese timezone (UTC+7)
    const now = new Date();
    const vietnamOffset = 7 * 60; // Vietnam is UTC+7 (420 minutes)
    const localOffset = now.getTimezoneOffset(); // Local timezone offset in minutes (negative for UTC+)
    
    // Calculate Vietnam time
    const vietnamTime = new Date(now.getTime() + (vietnamOffset + localOffset) * 60 * 1000);
    
    let start: Date;
    let end: Date;

    switch (timeRange) {
      case TimeRange.TODAY:
        // Start of today in Vietnam time
        start = new Date(vietnamTime.getFullYear(), vietnamTime.getMonth(), vietnamTime.getDate());
        // End of today in Vietnam time
        end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        break;

      case TimeRange.LAST_WEEK:
        // Start of 7 days ago in Vietnam time
        const sevenDaysAgo = new Date(vietnamTime.getTime() - 7 * 24 * 60 * 60 * 1000);
        start = new Date(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate());
        // End is start of today
        end = new Date(vietnamTime.getFullYear(), vietnamTime.getMonth(), vietnamTime.getDate());
        break;

      case TimeRange.LAST_MONTH:
        // Start of last month in Vietnam time
        const lastMonth = vietnamTime.getMonth() === 0 ? 11 : vietnamTime.getMonth() - 1;
        const lastMonthYear = vietnamTime.getMonth() === 0 ? vietnamTime.getFullYear() - 1 : vietnamTime.getFullYear();
        start = new Date(lastMonthYear, lastMonth, 1);
        // End of last month
        end = new Date(vietnamTime.getFullYear(), vietnamTime.getMonth(), 1);
        break;

      case TimeRange.LAST_YEAR:
        // Start of last year in Vietnam time
        const lastYear = vietnamTime.getFullYear() - 1;
        start = new Date(lastYear, 0, 1);
        // End of last year (start of current year)
        end = new Date(vietnamTime.getFullYear(), 0, 1);
        break;

      default:
        throw new Error('Invalid time range');
    }

    // Convert back to UTC for MongoDB query
    const utcStart = new Date(start.getTime() - vietnamOffset * 60 * 1000);
    const utcEnd = new Date(end.getTime() - vietnamOffset * 60 * 1000);

    return { start: utcStart, end: utcEnd };
  }
  
  async getLikedPosts(
    userId: string, 
    page: number = 1, 
    limit: number = 20,
    timeRange?: TimeRange,
    sortOrder: SortOrder = SortOrder.DESC
  ): Promise<{ posts: any[], totalCount: number, totalPages: number, currentPage: number }> {
    const skip = (page - 1) * limit;
    
    // Build time range filter
    let timeFilter: any = {};
    if (timeRange) {
      const { start, end } = this.getVietnameseTimeBounds(timeRange);
      timeFilter = {
        createdAt: {
          $gte: start,
          $lt: end
        }
      };
    }
    
    // Build query with time filter
    const query = { userId, ...timeFilter };
    
    // Build sort order (sorting by when the post was liked)
    const sortDirection: 1 | -1 = sortOrder === SortOrder.ASC ? 1 : -1;
    const sortQuery: { [key: string]: 1 | -1 } = { createdAt: sortDirection };
    
    // Get paginated liked post records, sorted by like time
    const likedPostRecords = await this.postLikeModel
      .find(query)
      .select('postId createdAt')
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .lean();

    const likedPostIds = likedPostRecords.map(record => record.postId);

    if (likedPostIds.length === 0) {
      const totalCount = await this.postLikeModel.countDocuments(query);
      return {
        posts: [],
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page
      };
    }

    // Get total count of liked posts for pagination (with time filter)
    const totalCount = await this.postLikeModel.countDocuments(query);

    // Use the post service's base pipeline but without pagination (since we paginated at like level)
    const currentUser = new Types.ObjectId(userId);
    const baseMatch = { _id: { $in: likedPostIds } };
    
    const posts = await this.postModel
      .aggregate([
        ...this.postService.buildBasePipeline(currentUser, baseMatch),
      ])
      .exec();

    // Maintain the like order based on the sorted likedPostIds
    // This preserves the chronological order of when posts were liked
    const postsOrderedByLikeTime = likedPostIds.map(likedId => 
      posts.find(post => post._id.toString() === likedId.toString())
    ).filter(Boolean);

    return {
      posts: postsOrderedByLikeTime,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    };
  }
  
async getPostLikers(postId: string, currentUserId: string) {
  const likes = await this.postLikeModel
    .find({ postId })
    .select('userId')
    .lean();

  const userIds = likes.map(like => like.userId);

  const users = await this.userModel
    .find({ _id: { $in: userIds } })
    .select('username handleName profilePic')
    .lean();

  const enrichedUsers = await Promise.all(
    users.map(async (user) => {
      const targetId = user._id.toString();
      
      // Skip if it's the current user
      if (currentUserId === targetId) {
        return {
          userId: targetId,  
          username: user.username,
          handleName: user.handleName,
          profilePic: user.profilePic || '',
          isCurrentUser: true 
          // userFollowing: false
        };
      }

        // Get relation status
        const { relation, userOneIsActing } = await this.relationService.getRelation(
          currentUserId,
          targetId
        );

        if (!relation) {
          return {
            userId: targetId,
            username: user.username,
            handleName: user.handleName,
            profilePic: user.profilePic || '',
            userFollowing: false,
            isCurrentUser: false
          };
        }

        const [oneRel, twoRel] = relation.split('_');

        // Check for blocks first
        if (userOneIsActing) {
          // currentUser is userOne
          if (oneRel === 'BLOCK' || twoRel === 'BLOCK') return null;
        } else {
          // currentUser is userTwo
          if (twoRel === 'BLOCK' || oneRel === 'BLOCK') return null;
        }

        // If not blocked, check follow status
        const userFollowing = userOneIsActing ? 
          oneRel === 'FOLLOW' : 
          twoRel === 'FOLLOW';

        return {
          userId: user._id,
          username: user.username,
          handleName: user.handleName,
          profilePic: user.profilePic || '',
          userFollowing,
          isCurrentUser: false
        };
      })
    );
    const filteredUsers = enrichedUsers.filter(user => user !== null);
    return filteredUsers.sort((a, b) => {
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      return 0;
    }).map(({ isCurrentUser, ...user }) => user); // Remove the isCurrentUser flag from final output
  }

  async findByPostId(postID: string): Promise<PostLike[]> {
    return this.postLikeModel.find({ postId: postID }).exec();
  }

  async getPostLikesCount(postId: string): Promise<number> {
    return await this.postLikeModel.countDocuments({ postId });
  }

  async isMeLikePost(userId: string, postId: string): Promise<boolean> {
    const count = await this.postLikeModel.countDocuments({ postId, userId });
    return count > 0;
  }
}
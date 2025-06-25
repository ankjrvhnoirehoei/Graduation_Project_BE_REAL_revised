import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PostLike, PostLikeDocument } from './like_post.schema';
import { Post, PostDocument } from 'src/post/post.schema';
import { User, UserDocument } from 'src/user/user.schema'; 
import { RelationService } from 'src/relation/relation.service';

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
  
  async getLikedPosts(
    userId: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<{ posts: any[], totalCount: number, totalPages: number, currentPage: number }> {
    // calculate skip value for pagination
    const skip = (page - 1) * limit;

    // get all post IDs liked by the user (ordered by creation time, newest first)
    const likedPostRecords = await this.postLikeModel
      .find({ userId })
      .select('postId')
      .sort({ createdAt: -1 })
      .lean();

    const likedPostIds = likedPostRecords.map(record => record.postId);

    if (likedPostIds.length === 0) {
      return {
        posts: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page
      };
    }

    // get total count of enabled posts that user has liked
    const totalEnabledPosts = await this.postModel.countDocuments({
      _id: { $in: likedPostIds },
      isEnable: { $ne: false }
    });

    // fetch the actual posts with pagination and only enabled posts
    const posts = await this.postModel
      .find({ 
        _id: { $in: likedPostIds },
        isEnable: { $ne: false }
      })
      .select({
        userID: 1,
        musicID: 1,
        type: 1,
        caption: 1,
        isFlagged: 1,
        nsfw: 1,
        isEnable: 1,
        location: 1,
        isArchived: 1,
        viewCount: 1
      })
      .skip(skip)
      .limit(limit)
      .lean();

    const transformedPosts = posts.map(post => ({
      _id: post._id,
      userID: post.userID,
      musicID: post.music?.musicId || null,
      type: post.type,
      caption: post.caption || null,
      isFlagged: post.isFlagged || false,
      nsfw: post.nsfw || false,
      isEnable: post.isEnable !== false, 
      location: post.location || null,
      isArchived: post.isArchived || false,
      viewCount: post.viewCount || 0
    }));

    return {
      posts: transformedPosts,
      totalCount: totalEnabledPosts,
      totalPages: Math.ceil(totalEnabledPosts / limit),
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
}
import { Injectable, ConflictException, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PostLike, PostLikeDocument } from './like_post.schema';
import { Post, PostDocument } from 'src/post/post.schema';
import { User, UserDocument } from 'src/user/user.schema'; 
import { RelationService } from 'src/relation/relation.service';
import { PostService } from 'src/post/post.service';

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
  
  async getLikedPosts(
    userId: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<{ posts: any[], totalCount: number, totalPages: number, currentPage: number }> {
    const skip = (page - 1) * limit;
    
    const likedPostRecords = await this.postLikeModel
      .find({ userId })
      .select('postId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const likedPostIds = likedPostRecords.map(record => record.postId);

    if (likedPostIds.length === 0) {
      const totalCount = await this.postLikeModel.countDocuments({ userId });
      return {
        posts: [],
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page
      };
    }

    // Get total count of liked posts for pagination
    const totalCount = await this.postLikeModel.countDocuments({ userId });

    // Use the post service's base pipeline but without pagination (since we paginated at like level)
    const currentUser = new Types.ObjectId(userId);
    const baseMatch = { _id: { $in: likedPostIds } };
    
    const posts = await this.postModel
      .aggregate([
        ...this.postService.buildBasePipeline(currentUser, baseMatch),
        { $sort: { createdAt: -1 } } 
      ])
      .exec();

    // If you want to maintain the like order, you can sort the posts based on likedPostIds order
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
}
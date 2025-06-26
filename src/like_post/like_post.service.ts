import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { PostLike, PostLikeDocument } from './like_post.schema';
import { Post, PostDocument } from 'src/post/post.schema';
import { User, UserDocument } from 'src/user/user.schema'; 
import { RelationService } from 'src/relation/relation.service';
import { NotificationService } from 'src/notification/notification.service';

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
    private readonly notificationService: NotificationService,
  ) {}

  async like(postId: string, userId: string): Promise<void> {
    const existing = await this.postLikeModel.findOne({ postId, userId });
    if (existing) throw new ConflictException('User has already liked this post');

    await this.postLikeModel.create({ postId, userId });

    // fetch post to get owner
    const post = await this.postModel.findById(postId).select('userID').lean();
    if (!post) throw new NotFoundException('Post not found');

    const postOwner = post.userID.toString();

    // don't notify if liking your own post
    if (postOwner === userId) return;

    await this.notificationService.notifyLike(
      userId,
      postOwner,
      postId,
    );
  }
      
  async unlike(postId: string, userId: string): Promise<void> {
    await this.postLikeModel.deleteOne({ postId, userId });

    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');

    const postOwner = post.userID.toString();
    if (postOwner === userId) return;

    await this.notificationService.retractLike(userId, postOwner, postId);
  }
  
  async getLikedPosts(
    userId: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<{ posts: any[], totalCount: number, totalPages: number, currentPage: number }> {
    const currentUser = new Types.ObjectId(userId);
    const skip = (page - 1) * limit;

    // Build the aggregation pipeline for liked posts
    const basePipeline: PipelineStage[] = [
      // Start from postlikes collection to maintain chronological order of likes
      {
        $match: {
          userId: currentUser
        }
      },
      // Sort by when the post was liked (newest likes first)
      {
        $sort: { createdAt: -1 }
      },
      // Join with posts collection
      {
        $lookup: {
          from: 'posts',
          localField: 'postId',
          foreignField: '_id',
          as: 'post'
        }
      },
      {
        $unwind: '$post'
      },
      // Filter out disabled, NSFW, or non-post/reel content
      {
        $match: {
          'post.isEnable': true,
          'post.nsfw': false,
          'post.type': { $in: ['post', 'reel'] }
        }
      },
      // Replace root with post document but keep like timestamp for sorting
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              '$post',
              { likedAt: '$createdAt' } // Keep track of when it was liked
            ]
          }
        }
      },
      // Add relation lookup (same as main feed)
      {
        $lookup: {
          from: 'relations',
          let: {
            pu: '$userID',       
            cu: currentUser     
          },
          pipeline: [
            {
              $addFields: {
                pair: {
                  $cond: [
                    { $lt: ['$$cu', '$$pu'] },
                    { u1: '$$cu', u2: '$$pu', userOneIsCurrent: true },
                    { u1: '$$pu', u2: '$$cu', userOneIsCurrent: false }
                  ]
                }
              }
            },
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userOneID', '$pair.u1'] },
                    { $eq: ['$userTwoID', '$pair.u2'] }
                  ]
                }
              }
            },
            {
              $project: {
                _id: 0,
                relation: 1,
                userOneIsCurrent: '$pair.userOneIsCurrent'
              }
            }
          ],
          as: 'relationLookup'
        }
      },
      // Process relation status
      {
        $addFields: {
          isFollow: {
            $let: {
              vars: { rel: { $arrayElemAt: ['$relationLookup', 0] } },
              in: {
                $cond: [
                  { $eq: ['$$rel', null] },
                  false,
                  {
                    $switch: {
                      branches: [
                        {
                          case: { $eq: ['$$rel.userOneIsCurrent', true] },
                          then: { $eq: [{ $arrayElemAt: [{ $split: ['$$rel.relation', '_'] }, 0] }, 'FOLLOW'] }
                        },
                        {
                          case: { $eq: ['$$rel.userOneIsCurrent', false] },
                          then: { $eq: [{ $arrayElemAt: [{ $split: ['$$rel.relation', '_'] }, 1] }, 'FOLLOW'] }
                        }
                      ],
                      default: false
                    }
                  }
                ]
              }
            }
          }
        }
      },
      {
        $project: {
          relationLookup: 0
        }
      },
      {
        $addFields: {
          isFollow: {
            $cond: [
              { $eq: ['$userID', currentUser] },
              '$$REMOVE',
              '$isFollow'
            ]
          }
        }
      },
      // Check for hidden posts
      {
        $lookup: {
          from: 'hiddenposts',
          localField: '_id',
          foreignField: 'postId',
          as: 'hidden',
        },
      },
      {
        $match: {
          $expr: {
            $not: {
              $in: [currentUser, '$hidden.userId'],
            },
          }
        },
      },
      // Lookup media
      {
        $lookup: {
          from: 'media',
          localField: '_id',
          foreignField: 'postID',
          as: 'media',
        },
      },
      // Lookup user info
      {
        $lookup: {
          from: 'users',
          localField: 'userID',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      // Lookup likes
      {
        $lookup: {
          from: 'postlikes',
          localField: '_id',
          foreignField: 'postId',
          as: 'likes',
        },
      },
      // Lookup comments
      {
        $lookup: {
          from: 'comments',
          let: { postID: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$postID', '$$postID'] },
                    { $eq: ['$isDeleted', false] },
                  ],
                },
              },
            },
          ],
          as: 'comments',
        },
      },
      // Add counts
      {
        $addFields: {
          commentCount: { $size: '$comments' },
          likeCount: { $size: '$likes' },
        },
      },
      // Lookup music info
      {
        $lookup: {
          from: 'musics',
          localField: 'music.musicId',
          foreignField: '_id',
          as: 'musicInfo',
        },
      },
      {
        $unwind: {
          path: '$musicInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      // Check if current user liked (should always be true for this endpoint)
      {
        $lookup: {
          from: 'postlikes',
          let: { postId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$postId', '$$postId'] },
                    { $eq: ['$userId', currentUser] },
                  ],
                },
              },
            },
          ],
          as: 'userLikeEntry',
        },
      },
      {
        $addFields: {
          isLike: { $gt: [{ $size: '$userLikeEntry' }, 0] },
        },
      },
      // Lookup bookmarks
      {
        $lookup: {
          from: 'bookmarkplaylists',
          let: { uid: currentUser },
          pipeline: [
            { 
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userID', '$$uid'] },
                    { $eq: ['$isDeleted', false] }
                  ]
                }
              }
            },
            { $project: { _id: 1 } }
          ],
          as: 'myPlaylists'
        }
      },
      {
        $lookup: {
          from: 'bookmarkitems',
          let: { postId: '$_id', pls: '$myPlaylists._id' },
          pipeline: [
            { 
              $match: {
                $expr: {
                  $and: [
                    { $in: ['$playlistID', '$$pls'] },
                    { $eq: ['$itemID', '$$postId'] },
                    { $eq: ['$isDeleted', false] }
                  ]
                }
              }
            },
            { $limit: 1 }
          ],
          as: 'bookmarkEntry'
        }
      },
      {
        $addFields: {
          isBookmarked: { $gt: [{ $size: '$bookmarkEntry' }, 0] }
        }
      },
      // Final projection to match main feed format
      {
        $project: {
          _id: 1,
          userID: 1,
          type: 1,
          caption: 1,
          isFlagged: 1,
          nsfw: 1,
          isEnable: 1,
          location: 1,
          isArchived: 1,
          viewCount: 1,
          share: 1,
          createdAt: 1,
          updatedAt: 1,
          media: 1,
          isLike: 1,
          likeCount: 1,
          commentCount: 1,
          music: 1,
          'user._id': 1,
          'user.handleName': 1,
          'user.profilePic': 1,
          'musicInfo.song': 1,
          'musicInfo.link': 1,
          'musicInfo.coverImg': 1,
          'musicInfo.author': 1,
          isFollow: 1,
          isBookmarked: 1,
          likedAt: 1, // Include when it was liked for potential future use
        },
      },
    ];

    // Get total count
    const countResult = await this.postLikeModel
      .aggregate([
        ...basePipeline,
        { $count: 'count' }
      ])
      .exec();

    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    // Get paginated results (maintain like chronological order)
    const posts = await this.postLikeModel
      .aggregate([
        ...basePipeline,
        { $sort: { likedAt: -1 } }, // Sort by when liked
        { $skip: skip },
        { $limit: limit },
      ])
      .exec();

    return {
      posts,
      totalCount,
      totalPages,
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
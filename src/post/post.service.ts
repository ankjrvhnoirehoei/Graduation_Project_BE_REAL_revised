import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { CreatePostDto } from './dto/post.dto';
import { Post, PostDocument } from './post.schema';
import { MediaService } from 'src/media/media.service';
import { CreateMediaDto } from 'src/media/dto/media.dto';
import { CommonServices, RecommendationConfig } from 'src/admin/helpers/helpers.service';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private readonly mediaService: MediaService,
    private readonly commonService: CommonServices,
  ) {}

  async create(postDto: CreatePostDto): Promise<Post> {
    const createdPost = new this.postModel({
      ...postDto,
      userID: new Types.ObjectId(postDto.userID),
    });
    return createdPost.save();
  }

  async createPostWithMediaAndMusic(postWithMediaDto: {
    post: CreatePostDto;
    media: CreateMediaDto[];
    music?: {
      musicId: string;
      timeStart: number;
      timeEnd: number;
    };
  }): Promise<{
    post: Post;
    media: any[];
    music?: {
      musicId: string;
      timeStart: number;
      timeEnd: number;
    };
  }> {
    const userId = postWithMediaDto.post.userID;
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userID from token');
    }

    const postData: any = {
      ...postWithMediaDto.post,
      userID: new Types.ObjectId(userId),
      viewCount: postWithMediaDto.post.viewCount ?? 0,
      isEnable: postWithMediaDto.post.isEnable ?? true,
    };

    let musicObject:
      | {
          musicId: Types.ObjectId;
          timeStart: number;
          timeEnd: number;
        }
      | undefined = undefined;

    if (postWithMediaDto.music) {
      const { musicId, timeStart, timeEnd } = postWithMediaDto.music;

      if (!Types.ObjectId.isValid(musicId)) {
        throw new BadRequestException('Invalid musicID');
      }

      musicObject = {
        musicId: new Types.ObjectId(musicId),
        timeStart,
        timeEnd,
      };

      postData.music = musicObject;
    }

    const createdPost = await this.create(postData);
    const postId = (createdPost as any)._id;

    const mediaCreated = await Promise.all(
      postWithMediaDto.media.map(async (media) => {
        return this.mediaService.create({
          ...media,
          postID: postId,
        });
      }),
    );

    return {
      post: createdPost,
      media: mediaCreated,
      music: musicObject
        ? {
            musicId: musicObject.musicId.toString(),
            timeStart: musicObject.timeStart,
            timeEnd: musicObject.timeEnd,
          }
        : undefined,
    };
  }

  async disablePosts(
    userId: string,
    postIds: string[],
  ): Promise<{ modifiedCount: number }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userID');
    }
    const objectIds = postIds.map((id) => {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException(`Invalid postId: ${id}`);
      }
      return new Types.ObjectId(id);
    });

    const userObjectId = new Types.ObjectId(userId);

    const result = await this.postModel.updateMany(
      {
        _id: { $in: objectIds },
        userID: userObjectId,
      },
      { $set: { isEnable: false } },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('No posts found for deletion');
    }

    return { modifiedCount: result.modifiedCount };
  }

  async getPostType(postId: string): Promise<'post' | 'reel' | 'music'> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID format');
    }

    const post = await this.postModel.findById(postId).select('type').lean();
    if (!post) {
      throw new BadRequestException('Post not found');
    }

    return post.type as 'post' | 'reel' | 'music';
  }



  private buildUserMediaPipeline(currentUser: Types.ObjectId): PipelineStage[] {
    return [
      // attach media[]
      {
        $lookup: {
          from: 'media',
          localField: '_id',
          foreignField: 'postID',
          as: 'media',
        },
      },

      // attach user[]
      {
        $lookup: {
          from: 'users',
          localField: 'userID',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },

      // compute likeCount
      {
        $lookup: {
          from: 'postlikes',
          localField: '_id',
          foreignField: 'postId',
          as: 'likes',
        },
      },
      {
        $addFields: {
          likeCount: { $size: '$likes' },
        },
      },

      // compute isLike for currentUser
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

      // attach music (if any)
      {
        $lookup: {
          from: 'music',
          localField: 'musicID',
          foreignField: '_id',
          as: 'music',
        },
      },
      {
        $unwind: {
          path: '$music',
          preserveNullAndEmptyArrays: true,
        },
      },

      // load this user's non‑deleted playlists
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
                    { $eq: ['$isDeleted', false] },
                  ],
                },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: 'myPlaylists',
        },
      },

      // count non‑deleted comments
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
      {
        $addFields: {
          commentCount: { $size: '$comments' },
        },
      },

      // check bookmark‐item in those playlists
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
                    { $eq: ['$isDeleted', false] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: 'bookmarkEntry',
        },
      },
      {
        $addFields: {
          isBookmarked: { $gt: [{ $size: '$bookmarkEntry' }, 0] },
        },
      },

      // final shape
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
          isBookmarked: 1,
        },
      },
    ];
  }

  async findAllWithMedia(userId: string, page = 1, limit = 20) {
    return this.commonService.runPagedAggregation(
      { _userId: userId, type: { $in: ['post', 'reel'] } },
      page,
      limit,
    );
  }

  // async findReelsWithMedia(userId: string, page = 1, limit = 20) {
  //   return this.commonService.runPagedAggregation(
  //     { _userId: userId, type: 'reel' },
  //     page,
  //     limit,
  //     20,
  //   );
  // }

  async findRecommendedPostsWithMedia(userId: string, page = 1, limit = 20) {
    const recommendationConfig = this.commonService.getDefaultRecommendationConfig();
    
    return this.commonService.runPagedAggregation(
      { _userId: userId, type: { $in: ['post', 'reel'] } },
      page,
      limit,
      undefined, // no sampling
      recommendationConfig,
    );
  }

  async findTrendingPostsWithMedia(userId: string, page = 1, limit = 20) {
    const trendingConfig = this.commonService.getTrendingRecommendationConfig();
    
    return this.commonService.runPagedAggregation(
      { _userId: userId, type: { $in: ['post', 'reel'] } },
      page,
      limit,
      undefined,
      trendingConfig,
    );
  }

  async findRecommendedReelsWithMedia(userId: string, page = 1, limit = 20) {
    const recommendationConfig = this.commonService.getDefaultRecommendationConfig();
    
    return this.commonService.runPagedAggregation(
      { _userId: userId, type: 'reel' },
      page,
      limit,
      20,
      recommendationConfig,
    );
  }

  // Custom recommendation with specific config
  async findPostsWithCustomRecommendation(
    userId: string, 
    page = 1, 
    limit = 20, 
    customConfig: Partial<RecommendationConfig>
  ) {
    const defaultConfig = this.commonService.getDefaultRecommendationConfig();
    const mergedConfig: RecommendationConfig = {
      ...defaultConfig,
      ...customConfig,
      weights: {
        ...defaultConfig.weights,
        ...customConfig.weights,
      },
      diversity: {
        ...defaultConfig.diversity,
        ...customConfig.diversity,
      },
    };

    return this.commonService.runPagedAggregation(
      { _userId: userId, type: { $in: ['post', 'reel'] } },
      page,
      limit,
      undefined,
      mergedConfig,
    );
  }

  private async runSinglePostAggregation(
    postId: string,
    userId: string,
  ): Promise<any> {
    const currentUser = new Types.ObjectId(userId);
    const matchFilter = { _id: new Types.ObjectId(postId) };

    const result = await this.postModel
      .aggregate([...this.commonService.buildBasePipeline(currentUser, matchFilter)])
      .exec();

    return result[0] || null;
  }

  async getPostById(postId: string, userId: string) {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundException('Invalid post ID format');
    }

    const post = await this.runSinglePostAggregation(postId, userId);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async getUserPostsWithMedia(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ total: number; items: any[] }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }
    const objectUserId = new Types.ObjectId(userId);
    const skip = (page - 1) * limit;

    const total = await this.postModel.countDocuments({
      userID: objectUserId,
      type: 'post',
    });

    const items = await this.postModel
      .aggregate([
        {
          $match: {
            userID: objectUserId,
            type: 'post',
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },

        ...this.buildUserMediaPipeline(objectUserId),
      ])
      .exec();

    return { total, items };
  }

  async getUserReelsWithMedia(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ total: number; items: any[] }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }
    const objectUserId = new Types.ObjectId(userId);
    const skip = (page - 1) * limit;

    const total = await this.postModel.countDocuments({
      userID: objectUserId,
      type: 'reel',
    });

    const items = await this.postModel
      .aggregate([
        {
          $match: {
            userID: objectUserId,
            type: 'reel',
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },

        ...this.buildUserMediaPipeline(objectUserId),
      ])
      .exec();

    return { total, items };
  }

  private buildCaptionSearchFilter(keyword: string): Record<string, any> {
    const keywordLower = keyword.toLowerCase();
    const tokens = keywordLower.split(/\s+/).filter((w) => w.length > 0);

    if (tokens.length > 1) {
      // multi-word: require each token anywhere in the caption (case-insensitive)
      const andClauses = tokens.map((tok) => ({
        caption: {
          $regex: tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          $options: 'i',
        },
      }));
      return { $and: andClauses };
    } else {
      // single word: just one regex
      const escaped = tokens[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return { caption: { $regex: escaped, $options: 'i' } };
    }
  }

  // Refactored search method using the unified pipeline
  async searchByCaptionPaginated(
    userId: string,
    keyword: string,
    page: number,
    limit: number,
  ): Promise<{
    message: string;
    posts: {
      items: any[];
      pagination: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
        limit: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
      };
    };
    reels: {
      items: any[];
      pagination: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
        limit: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
      };
    };
  }> {
    // validate the user ID
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId');
    }

    // build the caption search filter
    const captionSearchFilter = this.buildCaptionSearchFilter(keyword);

    // Build match filters for posts and reels
    const postsMatchFilter = {
      _userId: userId,
      type: { $ne: 'reel' },
      ...captionSearchFilter,
    };

    const reelsMatchFilter = {
      _userId: userId,
      type: 'reel',
      ...captionSearchFilter,
    };

    // Use the existing runPagedAggregation method for both posts and reels
    const [postsResult, reelsResult] = await Promise.all([
      this.commonService.runPagedAggregation(postsMatchFilter, page, limit),
      this.commonService.runPagedAggregation(reelsMatchFilter, page, limit),
    ]);

    return {
      message: 'Search results retrieved successfully',
      posts: {
        items: postsResult.items,
        pagination: postsResult.pagination,
      },
      reels: {
        items: reelsResult.items,
        pagination: reelsResult.pagination,
      },
    };
  }

  // returns the 30 most recent UNIQUE tags (strings without the '#') found in the captions
  async getRecentTags(userId: string): Promise<string[]> {
    // validate userId
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId');
    }
    const currentUserObjectId = new Types.ObjectId(userId);

    // aggregation pipeline
    const pipeline: PipelineStage[] = [
      // only enabled, non‐NSFW posts
      {
        $match: {
          isEnable: true,
          nsfw: false,
        },
      },

      // exclude anything this user has 'hidden'
      {
        $lookup: {
          from: 'hidden_posts',
          let: { postId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$postID', '$$postId'] },
                    { $eq: ['$userID', currentUserObjectId] },
                  ],
                },
              },
            },
          ],
          as: 'hidden',
        },
      },
      {
        $match: {
          hidden: { $eq: [] },
        },
      },

      // sort by newest and limit to the 30 most recent posts
      { $sort: { createdAt: -1 } },
      { $limit: 30 },

      // extract tags array from each caption
      {
        $project: {
          createdAt: 1,
          tags: {
            $map: {
              input: {
                $regexFindAll: {
                  input: '$caption',
                  regex: /#(\w+)/g,
                },
              },
              as: 'm',
              in: { $arrayElemAt: ['$$m.captures', 0] },
            },
          },
        },
      },

      // unwind so each tag becomes its own document
      { $unwind: '$tags' },

      // group by tag string, remembering the most recent `createdAt` it appeared
      {
        $group: {
          _id: '$tags',
          lastUsed: { $max: '$createdAt' },
        },
      },

      // sort tags by the timestamp of their most recent occurrence
      { $sort: { lastUsed: -1 } },

      // only take the top 30 unique tags
      { $limit: 30 },

      // project out just the tag text
      {
        $project: {
          _id: 0,
          tag: '$_id',
        },
      },
    ];

    const aggResults = await this.postModel.aggregate(pipeline).exec();

    // 4) Return array-of-strings
    return aggResults.map((r) => r.tag);
  }

  /**
   * Fetches another user's posts/reels, with full lookups for
   * isFollow, media, bookmarks, likes, comments, music, etc.
   */
  async getOtherUserContent(
    viewerId: string,
    targetUserId: string,
    page: number = 1,
    limit: number = 20,
    type?: 'posts' | 'reels',
  ): Promise<any> {
    const results: any = { message: 'Content retrieved successfully' };

    if (!type || type === 'posts') {
      const posts = await this.fetchByType(
        viewerId,
        targetUserId,
        'post',
        page,
        limit,
      );
      results.posts = {
        items: posts.items,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(posts.total / limit),
          totalCount: posts.total,
          limit,
          hasNextPage: page < Math.ceil(posts.total / limit),
          hasPrevPage: page > 1,
        },
      };
    }

    if (!type || type === 'reels') {
      const reels = await this.fetchByType(
        viewerId,
        targetUserId,
        'reel',
        page,
        limit,
      );
      results.reels = {
        items: reels.items,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(reels.total / limit),
          totalCount: reels.total,
          limit,
          hasNextPage: page < Math.ceil(reels.total / limit),
          hasPrevPage: page > 1,
        },
      };
    }

    return results;
  }

  private async fetchByType(
    viewerId: string,
    targetUserId: string,
    docType: 'post' | 'reel',
    page: number,
    limit: number,
  ): Promise<{ total: number; items: any[] }> {
    if (
      !Types.ObjectId.isValid(viewerId) ||
      !Types.ObjectId.isValid(targetUserId)
    ) {
      throw new BadRequestException('Invalid user ID format.');
    }
    const viewerObj = new Types.ObjectId(viewerId);
    const targetObj = new Types.ObjectId(targetUserId);
    const skip = (page - 1) * limit;

    // total count for pagination
    const total = await this.postModel.countDocuments({
      userID: targetObj,
      type: docType,
      isEnable: true,
      nsfw: false,
    });

    const pipeline: PipelineStage[] = [
      // 1) Only the target user's documents
      {
        $match: {
          userID: targetObj,
          type: docType,
          isEnable: true,
          nsfw: false,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },

      // 2) Compute isFollow
      {
        $lookup: {
          from: 'relations',
          let: { pu: '$userID', cu: viewerObj },
          pipeline: [
            {
              $addFields: {
                pair: {
                  $cond: [
                    { $lt: ['$$cu', '$$pu'] },
                    { u1: '$$cu', u2: '$$pu', userOneIsCurrent: true },
                    { u1: '$$pu', u2: '$$cu', userOneIsCurrent: false },
                  ],
                },
              },
            },
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userOneID', '$pair.u1'] },
                    { $eq: ['$userTwoID', '$pair.u2'] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                relation: 1,
                userOneIsCurrent: '$pair.userOneIsCurrent',
              },
            },
          ],
          as: 'relationLookup',
        },
      },
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
                          then: {
                            $eq: [
                              {
                                $arrayElemAt: [
                                  { $split: ['$$rel.relation', '_'] },
                                  0,
                                ],
                              },
                              'FOLLOW',
                            ],
                          },
                        },
                        {
                          case: { $eq: ['$$rel.userOneIsCurrent', false] },
                          then: {
                            $eq: [
                              {
                                $arrayElemAt: [
                                  { $split: ['$$rel.relation', '_'] },
                                  1,
                                ],
                              },
                              'FOLLOW',
                            ],
                          },
                        },
                      ],
                      default: false,
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $project: { relationLookup: 0 } },

      // 3) Exclude hidden posts
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
            $not: { $in: [viewerObj, '$hidden.userId'] },
          },
        },
      },

      // 4) Media
      {
        $lookup: {
          from: 'media',
          localField: '_id',
          foreignField: 'postID',
          as: 'media',
        },
      },

      // 5) Author profile
      {
        $lookup: {
          from: 'users',
          localField: 'userID',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },

      // 6) likeCount
      {
        $lookup: {
          from: 'postlikes',
          localField: '_id',
          foreignField: 'postId',
          as: 'likes',
        },
      },
      { $addFields: { likeCount: { $size: '$likes' } } },

      // 7) isLike
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
                    { $eq: ['$userId', viewerObj] },
                  ],
                },
              },
            },
          ],
          as: 'userLikeEntry',
        },
      },
      { $addFields: { isLike: { $gt: [{ $size: '$userLikeEntry' }, 0] } } },

      // 8) commentCount
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
      { $addFields: { commentCount: { $size: '$comments' } } },

      // 9) Music info
      {
        $lookup: {
          from: 'musics',
          localField: 'music.musicId',
          foreignField: '_id',
          as: 'musicInfo',
        },
      },
      { $unwind: { path: '$musicInfo', preserveNullAndEmptyArrays: true } },

      // 10) Bookmark
      {
        $lookup: {
          from: 'bookmarkplaylists',
          let: { uid: viewerObj },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userID', '$$uid'] },
                    { $eq: ['$isDeleted', false] },
                  ],
                },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: 'myPlaylists',
        },
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
                    { $eq: ['$isDeleted', false] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: 'bookmarkEntry',
        },
      },
      {
        $addFields: { isBookmarked: { $gt: [{ $size: '$bookmarkEntry' }, 0] } },
      },

      // 11) Final projection
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
          user: {
            _id: 1,
            handleName: 1,
            profilePic: 1,
          },
          isFollow: 1,
          isLike: 1,
          likeCount: 1,
          commentCount: 1,
          musicInfo: {
            song: 1,
            link: 1,
            coverImg: 1,
            author: 1,
          },
          isBookmarked: 1,
        },
      },
    ];

    const items = await this.postModel.aggregate(pipeline).exec();
    return { total, items };
  }

  async getAllReelsForUser(targetUserId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(targetUserId)) {
      throw new BadRequestException('Invalid user ID format');
    }
    const userObj = new Types.ObjectId(targetUserId);

    const pipeline: PipelineStage[] = [
      // 1) match reels for that user
      {
        $match: {
          userID: userObj,
          type: 'reel',
          isEnable: true,
          nsfw: false,
        },
      },
      { $sort: { createdAt: -1 } },

      // 2) owner info
      {
        $lookup: {
          from: 'users',
          localField: 'userID',
          foreignField: '_id',
          as: 'owner',
        },
      },
      { $unwind: '$owner' },

      // 3) commentCount
      {
        $lookup: {
          from: 'comments',
          let: { postId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$postID', '$$postId'] },
                    { $eq: ['$isDeleted', false] },
                  ],
                },
              },
            },
          ],
          as: 'comments',
        },
      },
      { $addFields: { commentCount: { $size: '$comments' } } },

      // 4) likes -> likeCount
      {
        $lookup: {
          from: 'postlikes',
          localField: '_id',
          foreignField: 'postId',
          as: 'likes',
        },
      },
      { $addFields: { likeCount: { $size: '$likes' } } },

      // 5) shareCount
      { $addFields: { shareCount: '$share' } },

      // 6) musicInfo
      {
        $lookup: {
          from: 'musics',
          localField: 'music.musicId',
          foreignField: '_id',
          as: 'musicArr',
        },
      },
      {
        $addFields: {
          music: {
            $cond: [
              { $gt: [{ $size: '$musicArr' }, 0] },
              {
                _id: { $arrayElemAt: ['$musicArr._id', 0] },
                media: { $arrayElemAt: ['$musicArr.link', 0] },
              },
              {},
            ],
          },
        },
      },
      // 7) lookup media by post ID
      {
        $lookup: {
          from: 'media',
          localField: '_id',
          foreignField: 'postID',
          as: 'mediaArr',
        },
      },
      // 9) pull out the first media doc for easy access
      {
        $addFields: {
          mediaObj: { $arrayElemAt: ['$mediaArr', 0] },
        },
      },

      // 10) build combined allMedia field
      {
        $addFields: {
          media: {
            // mediaId: '$mediaObj._id',
            videoUrl: {
              $cond: [
                { $gt: ['$$ROOT.mediaObj.videoUrl', null] },
                '$$ROOT.mediaObj.videoUrl',
                '$$ROOT.mediaObj.imageUrl',
              ],
            },
            audioId: '$music._id',
            audioUrl: '$music.media',
          },
        },
      },

      // 11) final projection
      {
        $project: {
          _id: 1,
          caption: 1,
          owner: {
            handleName: 1,
            profilePic: 1,
          },
          commentCount: 1,
          likeCount: 1,
          shareCount: 1,
          createdAt: 1,
          media: 1,
        },
      },
    ];

    return this.postModel.aggregate(pipeline).exec();
  }

  async disablePost(postId: string): Promise<Boolean> {
    const post = await this.postModel
      .findById(postId)
      .select('isEnable')
      .exec();
    if (!post) {
      throw new NotFoundException(`Post ${postId} not found`);
    }

    const newState = !post.isEnable;
    post.isEnable = newState;
    await post.save();

    return newState;
  }

  async getUserTaggedPosts(targetUser: string, currentUser: string, page: number = 1, limit: number = 10) {
    // find all media that have the user tagged
    const taggedMedia = await this.mediaService.findUserTaggedId(targetUser);
    
    if (!taggedMedia || taggedMedia.length === 0) {
      return {
        message: 'success',
        data: {
          items: [],
          pagination: {
            currentPage: page,
            totalPages: 1,
            totalCount: 0,
            limit,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
      };
    }

    // extract unique post IDs from tagged media
    const postIds = [...new Set(taggedMedia.map(media => media.postID))];

    // create match filter for posts that contain tagged media
    const matchFilter = {
      _userId: currentUser, // This will be used by buildBasePipeline for currentUser context
      _id: { $in: postIds }, // Only posts that have tagged media
    };

    // Use the existing aggregation helpers to get full posts with all data
    const result = await this.commonService.runPagedAggregation(matchFilter, page, limit);

    return {
      message: 'success',
      data: result,
    };
  }
}

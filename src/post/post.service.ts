import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { CreatePostDto } from './dto/post.dto';
import { Post, PostDocument } from './post.schema';
import { MediaService } from 'src/media/media.service';
import { CreateMediaDto } from 'src/media/dto/media.dto';
import {
  CommonServices,
  RecommendationConfig,
} from 'src/admin/helpers/helpers.service';
import { PagedResult, PostItem, runPagedAggregation } from 'src/ts/algorithm';
import { User, UserDocument } from 'src/user/user.schema';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private readonly mediaService: MediaService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private commonService: CommonServices,
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

  // async findRecommendedPostsWithMedia(userId: string, page = 1, limit = 20) {
  //   const recommendationConfig = this.commonService.getDefaultRecommendationConfig();

  //   return this.commonService.runPagedAggregation(
  //     { _userId: userId, type: { $in: ['post', 'reel'] } },
  //     page,
  //     limit,
  //     undefined, // no sampling
  //     recommendationConfig,
  //   );
  // }

  async findSimilarPosts(
    postId: string,
    userId: string,
    page = 1,
    limit = 10
  ): Promise<PagedResult> {
    const currentUser = new Types.ObjectId(userId);
    const referencePostId = new Types.ObjectId(postId);
    
    const referencePost = await this.postModel.findById(referencePostId).lean();
    if (!referencePost) {
      throw new NotFoundException('Reference post not found');
    }

    const similarityConfig = this.commonService.getDefaultSimilarityConfig();

    const baseMatch = {
      _id: { $ne: referencePostId },
      type: { $in: ['post', 'reel'] }
    };

    const basePipeline = this.commonService.buildBasePipeline(currentUser, baseMatch);
    
    // Add similarity scoring
    const similarityStages = this.commonService.buildSimilarityStages(
      referencePost,
      currentUser,
      similarityConfig
    );

    const musicLookup: PipelineStage[] = [
      {
        $lookup: {
          from: 'musics',
          localField: 'music.musicId',
          foreignField: '_id',
          as: 'musicInfo',
        },
      },
      { $unwind: { path: '$musicInfo', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          music: {
            musicId: '$music.musicId',
            timeStart: '$music.timeStart',
            timeEnd: '$music.timeEnd',
            song: '$musicInfo.song',
            link: '$musicInfo.link',
            author: '$musicInfo.author',
            coverImg: '$musicInfo.coverImg',
          },
        },
      },
      { $project: { musicInfo: 0 } },
    ];

    // Sort by similarity score
    const sortStages = this.commonService.buildSimilaritySortStages();

    // Get total count for pagination
    const countPipeline = [
      ...basePipeline,
      ...similarityStages,
      { $count: 'total' }
    ];
    
    const countResult = await this.postModel.aggregate(countPipeline).exec();
    const totalSimilarPosts = countResult[0]?.total || 0;

    let allPosts: any[] = [];
    
    if (page === 1) {
      const referencePostPipeline = [
        { $match: { _id: referencePostId } },
        ...this.commonService.buildBasePipeline(currentUser, {}),
        ...musicLookup
      ];

      const referencePostWithDetails = await this.postModel.aggregate(referencePostPipeline).exec();
      
      const similarPostsLimit = Math.max(limit - 1, 0);
      const similarPostsPipeline = [
        ...basePipeline,
        ...similarityStages,
        ...musicLookup,
        ...sortStages,
        { $limit: similarPostsLimit },
        {
          $project: {
            similarityScore: 0,
            similarityMeta: 0,
          }
        }
      ];

      const similarPosts = await this.postModel.aggregate(similarPostsPipeline).exec();

      allPosts = [
        ...(referencePostWithDetails.length > 0 ? referencePostWithDetails : []),
        ...similarPosts
      ];
    } else {
      const skip = (page - 1) * limit - 1;
      
      const similarPostsPipeline = [
        ...basePipeline,
        ...similarityStages,
        ...musicLookup,
        ...sortStages,
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            similarityScore: 0,
            similarityMeta: 0,
          }
        }
      ];

      const similarPosts = await this.postModel.aggregate(similarPostsPipeline).exec();
      allPosts = similarPosts;
    }

    const postItems: PostItem[] = allPosts.map((d) => ({
      _id: d._id.toString(),
      userID: d.userID.toString(),
      type: d.type,
      caption: d.caption,
      isFlagged: d.isFlagged,
      nsfw: d.nsfw,
      isEnable: d.isEnable,
      viewCount: d.viewCount,
      share: d.share,
      createdAt: (d.createdAt as Date).toISOString(),
      updatedAt: (d.updatedAt as Date).toISOString(),
      media: d.media,
      likeCount: d.likeCount,
      commentCount: d.commentCount,
      isLike: d.isLike,
      isBookmarked: d.isBookmarked,
      isFollow: d.isFollow,
      user: {
        _id: d.user._id.toString(),
        username: d.user.username,
        handleName: d.user.handleName,
        profilePic: d.user.profilePic,
      },
      music: d.music,
      musicInfo: d.music
        ? {
            song: d.music.song,
            link: d.music.link,
            author: d.music.author,
            coverImg: d.music.coverImg,
          }
        : null,
    }));

    // Calculate pagination considering reference post takes 1 slot in page 1
    const totalItems = totalSimilarPosts + 1; // +1 for reference post
    const totalPages = Math.max(Math.ceil(totalItems / limit), 1);

    return {
      items: postItems,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount: totalItems,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };  
  }
  
  async findRecommendedPostsWithMedia(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PagedResult> {
    const currentUser = new Types.ObjectId(userId);
    const recommendationConfig =
      this.commonService.getDefaultRecommendationConfig();

    // nếu có recommendation thì lấy handleName
    let userHandleName = '';
    if (recommendationConfig.enableRecommendation) {
      const u = await this.userModel
        .findById(currentUser)
        .select('handleName')
        .lean();
      userHandleName = u?.handleName ?? '';
    }

    // match filter ban đầu
    const baseMatch = { type: { $in: ['post', 'reel'] } };

    // --- Gọi đúng methods trên commonService ---
    const basePipeline = this.commonService.buildBasePipeline(
      currentUser,
      baseMatch,
    );

    const musicLookup: PipelineStage[] = [
      {
        $lookup: {
          from: 'musics', // tên collection trong Mongo
          localField: 'music.musicId',
          foreignField: '_id',
          as: 'musicInfo',
        },
      },
      { $unwind: { path: '$musicInfo', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          music: {
            musicId: '$music.musicId',
            timeStart: '$music.timeStart',
            timeEnd: '$music.timeEnd',
            song: '$musicInfo.song',
            link: '$musicInfo.link',
            author: '$musicInfo.author',
            coverImg: '$musicInfo.coverImg',
          },
        },
      },
      { $project: { musicInfo: 0 } }, // bỏ mảng tạm
    ];

    const recPipeline =
      recommendationConfig.enableRecommendation && userHandleName
        ? this.commonService.buildRecommendationStages(
            currentUser,
            userHandleName,
            recommendationConfig,
          )
        : [];

    // project chỉ những field cần cho runPagedAggregation
    const projectStage: PipelineStage = {
      $project: {
        _id: 1,
        userID: 1,
        type: 1,
        caption: 1,
        isFlagged: 1,
        nsfw: 1,
        isEnable: 1,
        viewCount: 1,
        share: 1,
        createdAt: 1,
        updatedAt: 1,
        media: 1,
        likeCount: 1,
        commentCount: 1,
        isLike: 1,
        isBookmarked: 1,
        isFollow: 1,
        user: 1,
        music: 1,
      },
    };

    //  Lấy raw docs đã đầy đủ các lookup & counts
    const rawDocs = await this.postModel
      .aggregate([
        ...basePipeline,
        ...recPipeline,
        ...musicLookup,
        projectStage,
      ])
      .exec();

    // convert sang PostItem[] rồi sort + paginate
    const postItems: PostItem[] = rawDocs.map((d) => ({
      _id: d._id.toString(),
      userID: d.userID.toString(),
      type: d.type,
      caption: d.caption,
      isFlagged: d.isFlagged,
      nsfw: d.nsfw,
      isEnable: d.isEnable,
      viewCount: d.viewCount,
      share: d.share,
      createdAt: (d.createdAt as Date).toISOString(),
      updatedAt: (d.updatedAt as Date).toISOString(),
      media: d.media,
      likeCount: d.likeCount,
      commentCount: d.commentCount,
      isLike: d.isLike,
      isBookmarked: d.isBookmarked,
      isFollow: d.isFollow,
      user: {
        _id: d.user._id.toString(),
        username: d.user.username,
        handleName: d.user.handleName,
        profilePic: d.user.profilePic,
      },
      music: d.music,
      musicInfo: d.music
        ? {
            song: d.music.song,
            link: d.music.link,
            author: d.music.author,
            coverImg: d.music.coverImg,
          }
        : null,
    }));

    return runPagedAggregation(postItems, page, limit);
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

  // async findRecommendedReelsWithMedia(userId: string, page = 1, limit = 20) {
  //   const recommendationConfig =
  //     this.commonService.getDefaultRecommendationConfig();

  //   return this.commonService.runPagedAggregation(
  //     { _userId: userId, type: 'reel' },
  //     page,
  //     limit,
  //     20,
  //     recommendationConfig,
  //   );
  // }

  async findRecommendedReelsWithMedia(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PagedResult> {
    const currentUser = new Types.ObjectId(userId);
    const recommendationConfig =
      this.commonService.getDefaultRecommendationConfig();

    // Nếu có recommendation, lấy thêm handleName
    let userHandleName = '';
    if (recommendationConfig.enableRecommendation) {
      const u = await this.userModel
        .findById(currentUser)
        .select('handleName')
        .lean();
      userHandleName = u?.handleName ?? '';
    }

    // 1) Chỉ match theo type = 'reel'
    const baseMatch = { type: 'reel' };

    // 2) Build pipeline (lookup media, user, counts, flags…)
    const basePipeline: PipelineStage[] = this.commonService.buildBasePipeline(
      currentUser,
      baseMatch,
    );

    // 3) Nếu bật recommendation, nối thêm stages tính score (nhưng cuối cùng ta sẽ project bỏ đi)
    const recPipeline: PipelineStage[] =
      recommendationConfig.enableRecommendation && userHandleName
        ? this.commonService.buildRecommendationStages(
            currentUser,
            userHandleName,
            recommendationConfig,
          )
        : [];

    // 4) Cuối cùng chỉ project đúng những field algorithm.ts cần
    const projectStage: PipelineStage = {
      $project: {
        _id: 1,
        userID: 1,
        type: 1,
        caption: 1,
        isFlagged: 1,
        nsfw: 1,
        isEnable: 1,
        viewCount: 1,
        share: 1,
        createdAt: 1,
        updatedAt: 1,
        media: 1,
        likeCount: 1,
        commentCount: 1,
        isLike: 1,
        isBookmarked: 1,
        isFollow: 1,
        user: 1,
      },
    };

    // 5) Chạy aggregation lấy rawDocs
    const rawDocs = await this.postModel
      .aggregate([...basePipeline, ...recPipeline, projectStage])
      .exec();

    // 6) Transform thành PostItem[]
    const postItems: PostItem[] = rawDocs.map((d) => ({
      _id: d._id.toString(),
      userID: d.userID.toString(),
      type: d.type,
      caption: d.caption,
      isFlagged: d.isFlagged,
      nsfw: d.nsfw,
      isEnable: d.isEnable,
      viewCount: d.viewCount,
      share: d.share,
      createdAt: (d.createdAt as Date).toISOString(),
      updatedAt: (d.updatedAt as Date).toISOString(),
      media: d.media,
      likeCount: d.likeCount,
      commentCount: d.commentCount,
      isLike: d.isLike,
      isBookmarked: d.isBookmarked,
      isFollow: d.isFollow,
      user: {
        _id: d.user._id.toString(),
        username: d.user.username,
        handleName: d.user.handleName,
        profilePic: d.user.profilePic,
      },
    }));

    // 7) Gọi thuật toán O(n log n) + slice page/limit
    return runPagedAggregation(postItems, page, limit);
  }

  // Custom recommendation with specific config
  async findPostsWithCustomRecommendation(
    userId: string,
    page = 1,
    limit = 20,
    customConfig: Partial<RecommendationConfig>,
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
      .aggregate([
        ...this.commonService.buildBasePipeline(currentUser, matchFilter),
      ])
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

  async getUserPostsWithMedia(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ total: number; items: any[] }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const matchFilter = {
      _userId: userId,
      userID: new Types.ObjectId(userId),
      type: 'post',
    };

    const result = await this.commonService.runPagedAggregation(
      matchFilter,
      page,
      limit,
    );

    return {
      total: result.pagination.totalCount,
      items: result.items,
    };
  }

  async getUserReelsWithMedia(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ total: number; items: any[] }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const matchFilter = {
      _userId: userId,
      userID: new Types.ObjectId(userId),
      type: 'reel',
    };

    const result = await this.commonService.runPagedAggregation(
      matchFilter,
      page,
      limit,
    );

    return {
      total: result.pagination.totalCount,
      items: result.items,
    };
  }

  async getOtherUserContent(
    viewerId: string,
    targetUserId: string,
    page: number = 1,
    limit: number = 20,
    type?: 'posts' | 'reels',
  ): Promise<any> {
    if (
      !Types.ObjectId.isValid(viewerId) ||
      !Types.ObjectId.isValid(targetUserId)
    ) {
      throw new BadRequestException('Invalid user ID format.');
    }

    const results: any = { message: 'Content retrieved successfully' };

    if (!type || type === 'posts') {
      const matchFilter = {
        _userId: viewerId, // Current user
        userID: new Types.ObjectId(targetUserId), // Target user
        type: 'post',
      };

      const posts = await this.commonService.runPagedAggregation(
        matchFilter,
        page,
        limit,
      );

      results.posts = {
        items: posts.items,
        pagination: posts.pagination,
      };
    }

    if (!type || type === 'reels') {
      const matchFilter = {
        _userId: viewerId, // Current user
        userID: new Types.ObjectId(targetUserId), // Target user
        type: 'reel',
      };

      const reels = await this.commonService.runPagedAggregation(
        matchFilter,
        page,
        limit,
      );

      results.reels = {
        items: reels.items,
        pagination: reels.pagination,
      };
    }

    return results;
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

  async getUserTaggedPosts(
    targetUser: string,
    currentUser: string,
    page: number = 1,
    limit: number = 10,
  ) {
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
    const postIds = [...new Set(taggedMedia.map((media) => media.postID))];

    // create match filter for posts that contain tagged media
    const matchFilter = {
      _userId: currentUser, // This will be used by buildBasePipeline for currentUser context
      _id: { $in: postIds }, // Only posts that have tagged media
    };

    // Use the existing aggregation helpers to get full posts with all data
    const result = await this.commonService.runPagedAggregation(
      matchFilter,
      page,
      limit,
    );

    return {
      message: 'success',
      data: result,
    };
  }
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { CreatePostDto } from './dto/post.dto';
import { Post, PostDocument } from './post.schema';
import { MediaService } from 'src/media/media.service';
import { CreateMediaDto } from 'src/media/dto/media.dto';
import { MusicService } from 'src/music/music.service';
import { MusicPostDto } from 'src/music/dto/music.dto';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private readonly mediaService: MediaService,
    private readonly musicService: MusicService,
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

  async findAllWithMedia(userId: string): Promise<any[]> {
    return this.postModel.aggregate([
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
              $in: [{ $toObjectId: userId }, '$hidden.userId'],
            },
          },
          isEnable: true,
          nsfw: false,
          type: { $in: ['post', 'reel'] },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: 'media',
          localField: '_id',
          foreignField: 'postID',
          as: 'media',
        },
      },
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
        $lookup: {
          from: 'postlikes',
          localField: '_id',
          foreignField: 'postId',
          as: 'likes',
        },
      },
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
          likeCount: { $size: '$likes' },
        },
      },
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
                    { $eq: ['$userId', { $toObjectId: userId }] },
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
        },
      },
    ]);
  }

  async findReelsWithMedia(userId: string): Promise<any[]> {
    return this.postModel.aggregate([
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
              $in: [{ $toObjectId: userId }, '$hidden.userId'],
            },
          },
          type: 'reel',
          isEnable: true,
          nsfw: false,
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 50 },
      { $sample: { size: 20 } },
      {
        $lookup: {
          from: 'media',
          localField: '_id',
          foreignField: 'postID',
          as: 'media',
        },
      },
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
        $lookup: {
          from: 'postlikes',
          localField: '_id',
          foreignField: 'postId',
          as: 'likes',
        },
      },
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
          likeCount: { $size: '$likes' },
        },
      },
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
                    { $eq: ['$userId', { $toObjectId: userId }] },
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
        },
      },
    ]);
  }

  // returns up to 50 'post'‐type documents for the given user, plus a total count
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

    // count total number of 'post'-type documents for this user
    const total = await this.postModel.countDocuments({
      userID: objectUserId,
      type: 'post',
    });

    // fetch paginated results with lookups
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

        // lookup media documents attached to each post
        {
          $lookup: {
            from: 'media',
            localField: '_id',
            foreignField: 'postID',
            as: 'media',
          },
        },

        // lookup likes just to compute likeCount
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
        // check if current user has liked this post
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
                      { $eq: ['$userId', objectUserId] },
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

        // lookup music if any
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
            music: 1,
          },
        },
      ])
      .exec();

    return { total, items };
  }

  // returns up to 50 'reel'‐type documents for the given user, plus a total count.
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

        // lookup media
        {
          $lookup: {
            from: 'media',
            localField: '_id',
            foreignField: 'postID',
            as: 'media',
          },
        },

        // lookup likes to compute likeCount
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

        // check if current user has liked this post
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
                      { $eq: ['$userId', objectUserId] },
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

        // lookup music if any
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

        // project fields
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
            music: 1,
          },
        },
      ])
      .exec();

    return { total, items };
  }

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
    const currentUserObjectId = new Types.ObjectId(userId);

    // build the caption‐matching condition
    const keywordLower = keyword.toLowerCase();
    const tokens = keywordLower.split(/\s+/).filter((w) => w.length > 0);

    let captionMatch: Record<string, any>;
    if (tokens.length > 1) {
      // multi-word: require each token anywhere in the caption (case‐insensitive)
      const andClauses = tokens.map((tok) => ({
        caption: {
          $regex: tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          $options: 'i',
        },
      }));
      captionMatch = { $and: andClauses };
    } else {
      // single word: just one regex
      const escaped = tokens[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      captionMatch = { caption: { $regex: escaped, $options: 'i' } };
    }

    //    non‐reel  =>  type: { $ne: 'reel' }
    //    reels     =>  type: 'reel'
    //
    // each uses a $facet so we get BOTH a totalCount and a paginated data array in one shot

    const [postsResult, reelsResult] = await Promise.all([
      this._searchBucket(
        currentUserObjectId,
        captionMatch,
        { $ne: 'reel' },
        page,
        limit,
      ),
      this._searchBucket(
        currentUserObjectId,
        captionMatch,
        'reel',
        page,
        limit,
      ),
    ]);

    // compute 'totalPages', 'hasNextPage', 'hasPrevPage' for each bucket
    const computePagination = (totalCount: number) => {
      const totalPages = Math.ceil(totalCount / limit) || 1;
      return {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      };
    };

    return {
      message: 'Search results retrieved successfully',
      posts: {
        items: postsResult.items,
        pagination: computePagination(postsResult.totalCount),
      },
      reels: {
        items: reelsResult.items,
        pagination: computePagination(reelsResult.totalCount),
      },
    };
  }

  /**
   * a helper that runs an aggregation 'bucket':
   *   `typeFilter` can be either a string (e.g. 'reel') or an object (e.g. { $ne: 'reel' })
   *   it returns { totalCount, items: [ one page of data ] }
   */
  private async _searchBucket(
    currentUserObjectId: Types.ObjectId,
    captionMatch: Record<string, any>,
    typeFilter: string | Record<string, any>,
    page: number,
    limit: number,
  ): Promise<{ totalCount: number; items: any[] }> {
    // calculate how many docs to skip
    const skipCount = (page - 1) * limit;

    const pipeline = [
      // only consider enabled, non‐NSFW, matching captions, and matching typeFilter
      {
        $match: {
          isEnable: true,
          nsfw: false,
          type: typeFilter,
          ...captionMatch,
        },
      },

      // exclude anything the current user has 'hidden'
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
      { $match: { hidden: { $eq: [] } } },

      // sort by creation date (most recent first)
      { $sort: { createdAt: -1 as -1 } },

      // use a $facet to get BOTH a totalCount and the 'data page'
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }],
          data: [
            // lookup media array
            {
              $lookup: {
                from: 'media',
                localField: '_id',
                foreignField: 'postID',
                as: 'media',
              },
            },
            // lookup user info
            {
              $lookup: {
                from: 'users',
                localField: 'userID',
                foreignField: '_id',
                as: 'user',
              },
            },
            { $unwind: '$user' },

            // lookup total likes
            {
              $lookup: {
                from: 'postlikes',
                localField: '_id',
                foreignField: 'postId',
                as: 'likes',
              },
            },

            // lookup comments (non‐deleted only)
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

            // add commentCount & likeCount fields
            {
              $addFields: {
                commentCount: { $size: '$comments' },
                likeCount: { $size: '$likes' },
              },
            },

            // check if current user has liked this post
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
                          { $eq: ['$userId', currentUserObjectId] },
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

            // lookup optional music
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

            // project the exact fields
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
              },
            },

            // skip & limit for pagination
            { $skip: skipCount },
            { $limit: limit },
          ],
        },
      },
    ];

    // run aggregation
    const [aggResult] = await this.postModel.aggregate(pipeline).exec();
    const totalCount =
      aggResult.metadata.length > 0 ? aggResult.metadata[0].totalCount : 0;

    return { totalCount, items: aggResult.data };
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
}

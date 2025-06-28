import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { CreatePostDto } from './dto/post.dto';
import { Post, PostDocument } from './post.schema';
import { MediaService } from 'src/media/media.service';
import { CreateMediaDto } from 'src/media/dto/media.dto';
import { MusicService } from 'src/music/music.service';
import { MusicPostDto } from 'src/music/dto/music.dto';
import { WeeklyPostsDto } from './dto/weekly-posts.dto';
import { LastTwoWeeksDto } from './dto/last-two-weeks.dto';
import { PostLikeService } from 'src/like_post/like_post.service';
import { CommentService } from 'src/comment/comment.service';
import { TopPostDto } from './dto/top-posts.dto';
import { UserService } from 'src/user/user.service';
import { Story, StoryDocument } from '../story/schema/story.schema'
import { PostLike, PostLikeDocument } from 'src/like_post/like_post.schema';
import { Comment, CommentDocument } from 'src/comment/comment.schema'; 

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private readonly mediaService: MediaService,
    private readonly musicService: MusicService,
    private readonly postLikeService: PostLikeService,
    private readonly commentService: CommentService,
    private readonly userService: UserService,
    @InjectModel(Story.name) private storyModel: Model<StoryDocument>,
    @InjectModel(PostLike.name) private postLikeModel: Model<PostLikeDocument>,
    @InjectModel(Story.name) private commentModel: Model<CommentDocument>,
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

  async findAllWithMedia(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: any[]; pagination: Pagination }> {
    const currentUser = new Types.ObjectId(userId);
    const skip = (page - 1) * limit;
    const basePipeline: PipelineStage[] = [
      {
          $lookup: {
            from: 'relations',
            let: {
              pu: '$userID',       
              cu: currentUser     
            },
            pipeline: [
              {
                // normalize ordering between cu and pu
                $addFields: {
                  pair: {
                    $cond: [
                      { $lt: ['$$cu',   '$$pu'] },
                      { u1: '$$cu', u2: '$$pu', userOneIsCurrent: true },
                      { u1: '$$pu', u2: '$$cu', userOneIsCurrent: false }
                    ]
                  }
                }
              },
              {
                // find the single document for that ordered pair
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
                // keep only the relation string and the bool for which side to inspect
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

        {
          // turn that lookup into a simple Boolean
          $addFields: {
            isFollow: {
              $let: {
                vars: { rel: { $arrayElemAt: ['$relationLookup', 0] } },
                in: {
                  $cond: [
                    // if no document -> not following
                    { $eq: ['$$rel', null] },
                    false,
                    // otherwise split "FOLLOW_NULL" -> [one, two] and check the correct half
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

        // finally, prune out the temporary `relationLookup` array
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
                '$$REMOVE',     // completely drop this field if post.owner == currentUser
                '$isFollow'     // otherwise keep what we just computed
              ]
            }
          }
        },
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
      // lookup the user's non-deleted playlists
      {
        $lookup: {
          from: 'bookmarkplaylists',
          let: { uid: currentUser },
          pipeline: [
            { $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userID', '$$uid'] },
                    { $eq: ['$isDeleted', false] }
                  ]
                }
            }},
            { $project: { _id: 1 } }
          ],
          as: 'myPlaylists'
        }
      },

      // lookup any bookmarkItem for this post in any of those playlists
      {
        $lookup: {
          from: 'bookmarkitems',
          let: { postId: '$_id', pls: '$myPlaylists._id' },
          pipeline: [
            { $match: {
                $expr: {
                  $and: [
                    { $in: ['$playlistID', '$$pls'] },
                    { $eq: ['$itemID', '$$postId'] },
                    { $eq: ['$isDeleted', false] }
                  ]
                }
            }},
            { $limit: 1 }
          ],
          as: 'bookmarkEntry'
        }
      },

      // set isBookmarked to true if we found at least one entry
      {
        $addFields: {
          isBookmarked: { $gt: [ { $size: '$bookmarkEntry' }, 0 ] }
        }
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
          'musicInfo.song': 1,
          'musicInfo.link': 1,
          'musicInfo.coverImg': 1,
          'musicInfo.author': 1,
          isFollow: 1,
          isBookmarked: 1,
        },
      },
    ];

        const countResult = await this.postModel
      .aggregate([
        ...basePipeline,
        { $count: 'count' }
      ])
      .exec();

    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    // 3) Fetch one page of data
    const items = await this.postModel
      .aggregate([
        ...basePipeline,
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        // (then the final lookups, $project, etc. that you already have)
      ])
      .exec();

    // 4) Build pagination object
    const pagination: Pagination = {
      currentPage: page,
      totalPages,
      totalCount,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return { items, pagination };
  }

  async findReelsWithMedia(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: any[]; pagination: Pagination }> {
    const currentUser = new Types.ObjectId(userId);
    const skip = (page - 1) * limit;
    const basePipeline: PipelineStage[] = [
      {
      $lookup: {
        from: 'relations',
        let: { pu: '$userID', cu: currentUser },
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
                            { $arrayElemAt: [{ $split: ['$$rel.relation', '_'] }, 0] },
                            'FOLLOW'
                          ]
                        }
                      },
                      {
                        case: { $eq: ['$$rel.userOneIsCurrent', false] },
                        then: {
                          $eq: [
                            { $arrayElemAt: [{ $split: ['$$rel.relation', '_'] }, 1] },
                            'FOLLOW'
                          ]
                        }
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
    { $project: { relationLookup: 0 } },
        {
          $addFields: {
            isFollow: {
              $cond: [
                { $eq: ['$userID', currentUser] },
                '$$REMOVE',     // completely drop this field if post.owner == currentUser
                '$isFollow'     // otherwise keep what we just computed
              ]
            }
          }
        },
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
      // lookup playlists
      {
        $lookup: {
          from: 'bookmarkplaylists',
          let: { uid: currentUser },
          pipeline: [
            { $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userID', '$$uid'] },
                    { $eq: ['$isDeleted', false] }
                  ]
                }
            }},
            { $project: { _id: 1 } }
          ],
          as: 'myPlaylists'
        }
      },
      // lookup bookmarkItems for this post
      {
        $lookup: {
          from: 'bookmarkitems',
          let: { postId: '$_id', pls: '$myPlaylists._id' },
          pipeline: [
            { $match: {
                $expr: {
                  $and: [
                    { $in: ['$playlistID', '$$pls'] },
                    { $eq: ['$itemID', '$$postId'] },
                    { $eq: ['$isDeleted', false] }
                  ]
                }
            }},
            { $limit: 1 }
          ],
          as: 'bookmarkEntry'
        }
      },
      // flag it
      {
        $addFields: {
          isBookmarked: { $gt: [ { $size: '$bookmarkEntry' }, 0 ] }
        }
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
          isFollow: 1,
          isBookmarked: 1,
        },
      },
    ];
       const countResult = await this.postModel
      .aggregate([
        ...basePipeline,
        { $count: 'count' }
      ])
      .exec();
    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);

    // 3) Fetch the page: re‑append sort/sample/limit and all your lookup/project stages
    const items = await this.postModel
      .aggregate([
        ...basePipeline,
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $sample: { size: 20 } },                // if you really want sampling AFTER paging
        { $lookup: { from: 'media', localField: '_id', foreignField: 'postID', as: 'media' } },
        { $lookup: { from: 'users', localField: 'userID', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $lookup: { from: 'postlikes', localField: '_id', foreignField: 'postId', as: 'likes' } },
        { $lookup: {
            from: 'comments',
            let: { postID: '$_id' },
            pipeline: [
              { $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$postID', '$$postID'] },
                      { $eq: ['$isDeleted', false] },
                    ]
                  }
                }
              }
            ],
            as: 'comments'
          }
        },
        { $addFields: { commentCount: { $size: '$comments' }, likeCount: { $size: '$likes' } } },
        { $lookup: {
            from: 'postlikes',
            let: { postId: '$_id' },
            pipeline: [
              { $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$postId', '$$postId'] },
                      { $eq: ['$userId', { $toObjectId: userId }] },
                    ]
                  }
                }
              }
            ],
            as: 'userLikeEntry'
          }
        },
        { $addFields: { isLike: { $gt: [{ $size: '$userLikeEntry' }, 0] } } },
        { $lookup: {
            from: 'bookmarkplaylists',
            let: { uid: currentUser },
            pipeline: [
              { $match: {
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
        { $lookup: {
            from: 'bookmarkitems',
            let: { postId: '$_id', pls: '$myPlaylists._id' },
            pipeline: [
              { $match: {
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
        { $addFields: { isBookmarked: { $gt: [{ $size: '$bookmarkEntry' }, 0] } } },
        { $project: {
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
            isFollow: 1,
            isBookmarked: 1,
          }
        },
      ])
      .exec();

    // 4) Build pagination metadata
    const pagination = {
      currentPage: page,
      totalPages,
      totalCount,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return { items, pagination }; 
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

        {
          $lookup: {
            from: 'users',
            localField: 'userID',
            foreignField: '_id',
            as: 'user',
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },

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
        // lookup playlists
        {
          $lookup: {
            from: 'bookmarkplaylists',
            let: { uid: objectUserId },
            pipeline: [
              { $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$userID', '$$uid'] },
                      { $eq: ['$isDeleted', false] }
                    ]
                  }
              }},
              { $project: { _id: 1 } }
            ],
            as: 'myPlaylists'
          }
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
                      { $eq: ['$isDeleted', false] }
                    ]
                  }
                }
              }
            ],
            as: 'comments'
          }
        },
        {
          $addFields: {
            commentCount: { $size: '$comments' }
          }
        },
        // lookup bookmarkItems for this post
        {
          $lookup: {
            from: 'bookmarkitems',
            let: { postId: '$_id', pls: '$myPlaylists._id' },
            pipeline: [
              { $match: {
                  $expr: {
                    $and: [
                      { $in: ['$playlistID', '$$pls'] },
                      { $eq: ['$itemID', '$$postId'] },
                      { $eq: ['$isDeleted', false] }
                    ]
                  }
              }},
              { $limit: 1 }
            ],
            as: 'bookmarkEntry'
          }
        },
        // flag it
        {
          $addFields: {
            isBookmarked: { $gt: [ { $size: '$bookmarkEntry' }, 0 ] }
          }
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
            'user._id': 1,
            'user.handleName': 1,
            'user.profilePic': 1,
            commentCount: 1,
            createdAt: 1,
            updatedAt: 1,
            isBookmarked: 1,
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

        {
          $lookup: {
            from: 'users',
            localField: 'userID',
            foreignField: '_id',
            as: 'user',
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },

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
        // lookup playlists
        {
          $lookup: {
            from: 'bookmarkplaylists',
            let: { uid: objectUserId },
            pipeline: [
              { $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$userID', '$$uid'] },
                      { $eq: ['$isDeleted', false] }
                    ]
                  }
              }},
              { $project: { _id: 1 } }
            ],
            as: 'myPlaylists'
          }
        },

        // lookup comments just to count non‑deleted ones
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
                      { $eq: ['$isDeleted', false] }
                    ]
                  }
                }
              }
            ],
            as: 'comments'
          }
        },
        {
          $addFields: {
            commentCount: { $size: '$comments' }
          }
        },
        // lookup bookmarkItems for this post
        {
          $lookup: {
            from: 'bookmarkitems',
            let: { postId: '$_id', pls: '$myPlaylists._id' },
            pipeline: [
              { $match: {
                  $expr: {
                    $and: [
                      { $in: ['$playlistID', '$$pls'] },
                      { $eq: ['$itemID', '$$postId'] },
                      { $eq: ['$isDeleted', false] }
                    ]
                  }
              }},
              { $limit: 1 }
            ],
            as: 'bookmarkEntry'
          }
        },
        // flag it
        {
          $addFields: {
            isBookmarked: { $gt: [ { $size: '$bookmarkEntry' }, 0 ] }
          }
        },

        // project fields
        {
          $project: {
            _id: 1,
            'user._id': 1,
            'user.handleName': 1,
            'user.profilePic': 1,
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
            isBookmarked: 1,
            media: 1,
            isLike: 1,
            commentCount: 1,
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

            // lookup playlists
            {
              $lookup: {
                from: 'bookmarkplaylists',
                let: { uid: currentUserObjectId },
                pipeline: [
                  { $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$userID', '$$uid'] },
                          { $eq: ['$isDeleted', false] }
                        ]
                      }
                  }},
                  { $project: { _id: 1 } }
                ],
                as: 'myPlaylists'
              }
            },
            // lookup bookmarkItems for this post
            {
              $lookup: {
                from: 'bookmarkitems',
                let: { postId: '$_id', pls: '$myPlaylists._id' },
                pipeline: [
                  { $match: {
                      $expr: {
                        $and: [
                          { $in: ['$playlistID', '$$pls'] },
                          { $eq: ['$itemID', '$$postId'] },
                          { $eq: ['$isDeleted', false] }
                        ]
                      }
                  }},
                  { $limit: 1 }
                ],
                as: 'bookmarkEntry'
              }
            },
            // flag it
            {
              $addFields: {
                isBookmarked: { $gt: [ { $size: '$bookmarkEntry' }, 0 ] }
              }
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

  // returns up to 20 'reel'‐type documents that have a music subdocument
  async findReelsWithMusic(userId: string): Promise<any[]> {
    const userObjectId = new Types.ObjectId(userId);

    return this.postModel.aggregate<PipelineStage[]>([
    {
      $lookup: {
        from: 'relations',
        let: { pu: '$userID', cu: userObjectId },
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
                            { $arrayElemAt: [{ $split: ['$$rel.relation', '_'] }, 0] },
                            'FOLLOW'
                          ]
                        }
                      },
                      {
                        case: { $eq: ['$$rel.userOneIsCurrent', false] },
                        then: {
                          $eq: [
                            { $arrayElemAt: [{ $split: ['$$rel.relation', '_'] }, 1] },
                            'FOLLOW'
                          ]
                        }
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
    { $project: { relationLookup: 0 } },
      // exclude any posts this user has hidden
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
          'hidden.userId': { $ne: userObjectId },
        },
      },

      // exclude any reels from users this user has blocked
      {
        $lookup: {
          from: 'userblocks',           
          let: { ownerId: '$userID' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$blockedUserId', '$$ownerId'] },
                    { $eq: ['$userId', userObjectId] },
                  ],
                },
              },
            },
          ],
          as: 'blocked',
        },
      },
      {
        $match: { 'blocked.0': { $exists: false } },
      },

      // only reels that actually have a music subdocument
      {
        $match: {
          type: 'reel',
          isEnable: true,
          nsfw: false,
          music: { $exists: true, $ne: null },
        },
      },

      // get the latest 50, then pick 20 at random
      { $sort: { createdAt: -1 } },
      { $limit: 50 },
      { $sample: { size: 20 } },

      // join media
      {
        $lookup: {
          from: 'media',
          localField: '_id',
          foreignField: 'postID',
          as: 'media',
        },
      },

      // populate user info
      {
        $lookup: {
          from: 'users',
          localField: 'userID',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },

      // join likes and comments to compute counts
      {
        $lookup: {
          from: 'postlikes',
          localField: '_id',
          foreignField: 'postId',
          as: 'likes',
        },
      },
      {
        $addFields: { likeCount: { $size: '$likes' } },
      },
      {
        $lookup: {
          from: 'comments',
          let: { pid: '$_id' },
          pipeline: [
            { $match: {
                $expr: {
                  $and: [
                    { $eq: ['$postID', '$$pid'] },
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
        $addFields: { commentCount: { $size: '$comments' } },
      },

      // check if current user liked each post
      {
        $lookup: {
          from: 'postlikes',
          let: { pid: '$_id' },
          pipeline: [
            { $match: {
                $expr: {
                  $and: [
                    { $eq: ['$postId', '$$pid'] },
                    { $eq: ['$userId', userObjectId] },
                  ],
                },
              },
            },
          ],
          as: 'userLikeEntry',
        },
      },
      {
        $addFields: { isLike: { $gt: [{ $size: '$userLikeEntry' }, 0] } },
      },

      // final projection
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
          music: 1,
          'user._id': 1,
          'user.handleName': 1,
          'user.profilePic': 1,
          likeCount: 1,
          commentCount: 1,
          isLike: 1,
          isFollow: 1,
        },
      },
    ]);
  }    

    /**
   * Fetches another user's posts/reels, with full lookups for
   * isFollow, media, bookmarks, likes, comments, music, etc.
   */
  async getOtherUserContent(
    viewerId:     string,
    targetUserId: string,
    page:          number = 1,
    limit:         number = 20,
    type?:        'posts' | 'reels',
  ): Promise<any> {
    const results: any = { message: 'Content retrieved successfully' };

    if (!type || type === 'posts') {
      const posts = await this.fetchByType(
        viewerId, targetUserId, 'post', page, limit
      );
      results.posts = {
        items:      posts.items,
        pagination: {
          currentPage: page,
          totalPages:  Math.ceil(posts.total / limit),
          totalCount:  posts.total,
          limit,
          hasNextPage: page < Math.ceil(posts.total / limit),
          hasPrevPage: page > 1,
        },
      };
    }

    if (!type || type === 'reels') {
      const reels = await this.fetchByType(
        viewerId, targetUserId, 'reel', page, limit
      );
      results.reels = {
        items:      reels.items,
        pagination: {
          currentPage: page,
          totalPages:  Math.ceil(reels.total / limit),
          totalCount:  reels.total,
          limit,
          hasNextPage: page < Math.ceil(reels.total / limit),
          hasPrevPage: page > 1,
        },
      };
    }

    return results;
  }


  private async fetchByType(
    viewerId:     string,
    targetUserId: string,
    docType:      'post' | 'reel',
    page:         number,
    limit:        number,
  ): Promise<{ total: number; items: any[] }> {
    if (!Types.ObjectId.isValid(viewerId) || !Types.ObjectId.isValid(targetUserId)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    const viewerObj = new Types.ObjectId(viewerId);
    const targetObj = new Types.ObjectId(targetUserId);
    const skip      = (page - 1) * limit;

    // total count for pagination
    const total = await this.postModel.countDocuments({
      userID:   targetObj,
      type:     docType,
      isEnable: true,
      nsfw:     false,
    });

    const pipeline: PipelineStage[] = [
      // 1) Only the target user's documents
      { $match: {
          userID:   targetObj,
          type:     docType,
          isEnable: true,
          nsfw:     false,
      }},
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },

      // 2) Compute isFollow
      {
        $lookup: {
          from: 'relations',
          let:  { pu: '$userID', cu: viewerObj },
          pipeline: [
            { $addFields: {
                pair: {
                  $cond: [
                    { $lt: ['$$cu', '$$pu'] },
                    { u1: '$$cu', u2: '$$pu', userOneIsCurrent: true },
                    { u1: '$$pu', u2: '$$cu', userOneIsCurrent: false }
                  ]
                }
            }},
            { $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userOneID', '$pair.u1'] },
                    { $eq: ['$userTwoID', '$pair.u2'] }
                  ]
                }
            }},
            { $project: { _id: 0, relation: 1, userOneIsCurrent: '$pair.userOneIsCurrent' } }
          ],
          as: 'relationLookup'
        }
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
                              { $arrayElemAt: [{ $split: ['$$rel.relation', '_'] }, 0] },
                              'FOLLOW'
                            ]
                          }
                        },
                        {
                          case: { $eq: ['$$rel.userOneIsCurrent', false] },
                          then: {
                            $eq: [
                              { $arrayElemAt: [{ $split: ['$$rel.relation', '_'] }, 1] },
                              'FOLLOW'
                            ]
                          }
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
      { $project: { relationLookup: 0 } },

      // 3) Exclude hidden posts
      {
        $lookup: {
          from: 'hiddenposts',
          localField: '_id',
          foreignField: 'postId',
          as: 'hidden',
        }
      },
      {
        $match: {
          $expr: {
            $not: { $in: [viewerObj, '$hidden.userId'] }
          }
        }
      },

      // 4) Media
      { $lookup: { from: 'media',  localField: '_id', foreignField: 'postID', as: 'media' } },

      // 5) Author profile
      { $lookup: { from: 'users',  localField: 'userID', foreignField: '_id',   as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },

      // 6) Likes -> likeCount
      { $lookup: { from: 'postlikes', localField: '_id', foreignField: 'postId', as: 'likes' } },
      { $addFields: { likeCount: { $size: '$likes' } } },

      // 7) isLike
      {
        $lookup: {
          from: 'postlikes',
          let: { postId: '$_id' },
          pipeline: [
            { $match: {
                $expr: {
                  $and: [
                    { $eq: ['$postId', '$$postId'] },
                    { $eq: ['$userId', viewerObj] }
                  ]
                }
            }}
          ],
          as: 'userLikeEntry'
        }
      },
      { $addFields: { isLike: { $gt: [{ $size: '$userLikeEntry' }, 0] } } },

      // 8) Comments -> commentCount
      {
        $lookup: {
          from: 'comments',
          let: { postID: '$_id' },
          pipeline: [
            { $match: {
                $expr: {
                  $and: [
                    { $eq: ['$postID', '$$postID'] },
                    { $eq: ['$isDeleted', false] }
                  ]
                }
            }}
          ],
          as: 'comments'
        }
      },
      { $addFields: { commentCount: { $size: '$comments' } } },

      // 9) Music info
      {
        $lookup: {
          from: 'musics',
          localField: 'music.musicId',
          foreignField: '_id',
          as: 'musicInfo'
        }
      },
      { $unwind: { path: '$musicInfo', preserveNullAndEmptyArrays: true } },

      // 10) Bookmark
      {
        $lookup: {
          from: 'bookmarkplaylists',
          let: { uid: viewerObj },
          pipeline: [
            { $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userID', '$$uid'] },
                    { $eq: ['$isDeleted', false] }
                  ]
                }
            }},
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
            { $match: {
                $expr: {
                  $and: [
                    { $in: ['$playlistID', '$$pls'] },
                    { $eq: ['$itemID', '$$postId'] },
                    { $eq: ['$isDeleted', false] }
                  ]
                }
            }},
            { $limit: 1 }
          ],
          as: 'bookmarkEntry'
        }
      },
      { $addFields: { isBookmarked: { $gt: [{ $size: '$bookmarkEntry' }, 0] } } },

      // 11) Final projection
      {
        $project: {
          _id:           1,
          userID:        1,
          type:          1,
          caption:       1,
          isFlagged:     1,
          nsfw:          1,
          isEnable:      1,
          location:      1,
          isArchived:    1,
          viewCount:     1,
          share:         1,
          createdAt:     1,
          updatedAt:     1,
          media:         1,
          user: {
            _id:         1,
            handleName:  1,
            profilePic:  1,
          },
          isFollow:      1,
          isLike:        1,
          likeCount:     1,
          commentCount:  1,
          musicInfo: {
            song:      1,
            link:      1,
            coverImg:  1,
            author:    1,
          },
          isBookmarked:  1,
        }
      }
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
          userID:   userObj,
          type:     'reel',
          isEnable: true,
          nsfw:     false,
        }
      },
      { $sort: { createdAt: -1 } },

      // 2) owner info
      {
        $lookup: {
          from: 'users',
          localField: 'userID',
          foreignField: '_id',
          as: 'owner'
        }
      },
      { $unwind: '$owner' },

      // 3) comments -> commentCount
      {
        $lookup: {
          from: 'comments',
          let: { postId: '$_id' },
          pipeline: [
            { $match: {
                $expr: {
                  $and: [
                    { $eq: ['$postID', '$$postId'] },
                    { $eq: ['$isDeleted', false] }
                  ]
                }
            }}
          ],
          as: 'comments'
        }
      },
      { $addFields: { commentCount: { $size: '$comments' } } },

      // 4) likes -> likeCount
      {
        $lookup: {
          from: 'postlikes',
          localField: '_id',
          foreignField: 'postId',
          as: 'likes'
        }
      },
      { $addFields: { likeCount: { $size: '$likes' } } },

      // 5) shareCount from share field
      { $addFields: { shareCount: '$share' } },

      // 6) musicInfo
      {
        $lookup: {
          from: 'musics',
          localField: 'music.musicId',
          foreignField: '_id',
          as: 'musicArr'
        }
      },
      {
        $addFields: {
          music: {
            $cond: [
              { $gt: [{ $size: '$musicArr' }, 0] },
              {
                _id:   { $arrayElemAt: ['$musicArr._id', 0] },
                media: { $arrayElemAt: ['$musicArr.link', 0] }
              },
              {}
            ]
          }
        }
      },
      // 7) lookup media by post ID
      {
        $lookup: {
          from: 'media',           
          localField: '_id',
          foreignField: 'postID',
          as: 'mediaArr'
        }
      },
          // 9) pull out the first media doc for easy access
    {
      $addFields: {
        mediaObj: { $arrayElemAt: ['$mediaArr', 0] }
      }
    },

    // 10) build combined allMedia field
    {
      $addFields: {
        media: {
          // mediaId: '$mediaObj._id',
          // choose videoUrl if present, otherwise imageUrl
          videoUrl: {
            $cond: [
              { $gt: ['$$ROOT.mediaObj.videoUrl', null] },
              '$$ROOT.mediaObj.videoUrl',
              '$$ROOT.mediaObj.imageUrl'
            ]
          },
          audioId: '$music._id',
          audioUrl: '$music.media'
        }
      }
    },

    // 11) final projection
    {
      $project: {
        _id:          1,
        caption:      1,
        owner: {
          handleName: 1,
          profilePic: 1
        },
        commentCount: 1,
        likeCount:    1,
        shareCount:   1,
        createdAt:    1,
        media:        1    
      }
    }
  ];

    return this.postModel.aggregate(pipeline).exec();
  } 
}

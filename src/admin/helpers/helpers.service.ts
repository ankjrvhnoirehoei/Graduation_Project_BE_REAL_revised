import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model, PipelineStage, Types } from 'mongoose';
import { WeeklyPostsDto } from 'src/post/dto/weekly-posts.dto';
import { Post, PostDocument } from 'src/post/post.schema';
import { User, UserDocument } from 'src/user/user.schema';
export type RangePair = { start: Date; end: Date };
export type RangeKey = '7days' | '30days' | 'year';
export interface RecommendationConfig {
  enableRecommendation: boolean;
  weights: {
    mediaTagged: number;       // Posts where user is tagged in media
    captionMentioned: number;  // Posts where user is mentioned in caption
    followedUsers: number;     // Posts from followed users
    engagement: number;        // High engagement posts
    recency: number;           // Recent posts
    bookmarkedMusic: number;   // Posts with music user has bookmarked
  };
  diversity: {
    enabled: boolean;
    randomFactor: number;      // 0-1, how much randomness to add
  };
  limits: {
    maxMediaTaggedPosts?: number;
    maxFollowedUserPosts?: number;
  };
}


@Injectable()
export class CommonServices {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}
  /**
   * Get local time boundaries for comparison periods
   * Uses Vietnamese timezone (UTC+7) for proper local time calculation
   */
  public getRanges(key: 'default' | '7days' | '30days' | 'year'): { current: RangePair; previous: RangePair } {
    const now = new Date();
    // Get today's start in local timezone
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let currStart: Date, prevStart: Date, prevEnd: Date;

    if (key === 'default') {
      // today vs yesterday (local time)
      currStart = todayStart;
      prevStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      prevEnd = new Date(todayStart.getTime() - 1);
    } else if (key === '7days' || key === '30days') {
      const days = key === '7days' ? 6 : 29; // inclusive of today
      currStart = new Date(todayStart.getTime() - days * 24 * 60 * 60 * 1000);
      // previous period is same length directly before
      const lengthMs = (days + 1) * 24 * 60 * 60 * 1000;
      prevEnd = new Date(currStart.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - lengthMs + 1);
    } else { // 'year'
      // Jan 1st this year to now (local time)
      currStart = new Date(now.getFullYear(), 0, 1);
      // same span in previous year
      const spanDays = Math.floor((now.getTime() - currStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      prevEnd = new Date(currStart.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - spanDays * 24 * 60 * 60 * 1000 + 1);
    }

    return {
      current: { start: currStart, end: now },
      previous: { start: prevStart, end: prevEnd },
    };
  }

  /**
   * Build range for analytics with proper timezone handling
   * Returns local time boundaries for aggregation
   */
  public buildRange(range: RangeKey): { from: Date; to: Date; unit: 'day' | 'month' } {
    const now = new Date();
    // Get today's start in local timezone
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let from: Date;
    let unit: 'day' | 'month';

    if (range === '7days') {
      from = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
      unit = 'day';
    } else if (range === '30days') {
      from = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);
      unit = 'day';
    } else { // 'year'
      from = new Date(now.getFullYear(), 0, 1);
      unit = 'month';
    }

    // End of today in local timezone
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);
    const to = unit === 'day' ? todayEnd : now;

    return { from, to, unit };
  }

  // Get Monday of current week in local timezone
  public getMondayOfWeek(date: Date = new Date()): Date {
    const todayDow = date.getDay();
    const daysSinceMonday = todayDow === 0 ? 6 : todayDow - 1;
    
    const monday = new Date(date);
    monday.setDate(date.getDate() - daysSinceMonday);
    monday.setHours(0, 0, 0, 0);
    
    return monday;
  }

  // Get first day of current month in local timezone
  public getFirstDayOfMonth(date: Date = new Date()): Date {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    firstDay.setHours(0, 0, 0, 0);
    return firstDay;
  }

  // Get year boundaries for analytics
  public getYearBoundaries(yearsBack: number = 1): { startDate: Date; endDate: Date } {
    const now = new Date();
    const currentYear = now.getFullYear();
    const startYear = currentYear - yearsBack;
    
    return {
      startDate: new Date(startYear, 0, 1), // Jan 1 of start year
      endDate: new Date(currentYear + 1, 0, 1) // Jan 1 of next year
    };
  }

  public formatDate(d: Date): string {
    const dd = `${d.getDate()}`.padStart(2, '0');
    const mm = `${d.getMonth() + 1}`.padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // Create aggregation pipeline for timezone-aware year/month grouping
  public createYearlyAggregation(startDate: Date, endDate: Date, includeType: boolean = true): PipelineStage[] {
    const pipeline: PipelineStage[] = [
      { $match: { createdAt: { $gte: startDate, $lt: endDate } } },
      {
        $addFields: {
          vietnameseDate: {
            $dateAdd: {
              startDate: '$createdAt',
              unit: 'hour',
              amount: 7
            }
          }
        }
      },
      {
        $project: {
          year: { $year: '$vietnameseDate' },
          month: { $month: '$vietnameseDate' },
          ...(includeType && { type: 1 }),
        },
      }
    ];

    if (includeType) {
      pipeline.push({
        $group: {
          _id: { year: '$year', month: '$month', type: '$type' },
          count: { $sum: 1 },
        },
      });
    } else {
      pipeline.push({
        $group: {
          _id: { year: '$year', month: '$month' },
          count: { $sum: 1 },
        },
      });
    }

    return pipeline;
  }  

  // Create aggregation pipeline for timezone-aware day-of-week grouping
  public createWeeklyAggregation(startDate: Date, endDate: Date): PipelineStage[] {
    return [
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lt: endDate
          }
        }
      },
      {
        $addFields: {
          vietnameseDate: {
            $dateAdd: {
              startDate: '$createdAt',
              unit: 'hour',
              amount: 7
            }
          }
        }
      },
      {
        $addFields: {
          adjustedDayOfWeek: {
            $cond: {
              if: { $eq: [{ $dayOfWeek: '$vietnameseDate' }, 1] }, // If Sunday
              then: 7, // Make it day 7
              else: { $subtract: [{ $dayOfWeek: '$vietnameseDate' }, 1] }
            }
          }
        }
      },
      {
        $group: {
          _id: '$adjustedDayOfWeek',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          dayOfWeek: '$_id',
          count: 1,
        },
      },
    ];
  }
  
  // Convert aggregation results to weekly format
  public formatWeeklyResults<T extends { day: WeeklyPostsDto['day'] }>(
    rawResults: Array<{ dayOfWeek: number; count: number }>,
    createEntry: (day: WeeklyPostsDto['day'], count: number) => T
  ): T[] {
    const labels: Record<number, WeeklyPostsDto['day']> = {
      1: 'T2',
      2: 'T3',
      3: 'T4',
      4: 'T5',
      5: 'T6',
      6: 'T7',
      7: 'CN',
    };

    const dayOrder = [1, 2, 3, 4, 5, 6, 7];
    const resultMap = new Map<number, number>();
    
    rawResults.forEach(({ dayOfWeek, count }) => {
      resultMap.set(dayOfWeek, count);
    });

    return dayOrder.map(dayNum => 
      createEntry(labels[dayNum], resultMap.get(dayNum) ?? 0)
    );
  }

  /** Safe percent change calculation */
  public combinedFluct(currSum: number, prevSum: number): { percentageChange: number; trend: string } {
    let pct: number;
    if (prevSum === 0) {
      pct = currSum === 0 ? 0 : 100;
    } else {
      pct = ((currSum - prevSum) / prevSum) * 100;
    }

    const trend = pct > 0 
      ? 'increase' 
      : pct < 0 
        ? 'decrease' 
        : 'no change';

    return { percentageChange: Math.round(pct), trend };
  }
  
  // posts pipeline
  public buildAdminBasePipeline(
    mockUserId: Types.ObjectId,
    matchFilter: Record<string, any>,
  ): PipelineStage[] {
    return [
      {
        $match: {
          ...matchFilter,
          isEnable: true,
          nsfw: false,
        },
      },

      // Media lookup
      {
        $lookup: {
          from: 'media',
          localField: '_id',
          foreignField: 'postID',
          as: 'media',
        },
      },

      // User lookup
      {
        $lookup: {
          from: 'users',
          localField: 'userID',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },

      // Likes lookup and count
      {
        $lookup: {
          from: 'postlikes',
          localField: '_id',
          foreignField: 'postId',
          as: 'likes',
        },
      },

      // Comments lookup and count
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
          likeCount: { $size: '$likes' },
          commentCount: { $size: '$comments' },
        },
      },

      // Music lookup
      {
        $lookup: {
          from: 'musics',
          localField: 'music.musicId',
          foreignField: '_id',
          as: 'musicInfo',
        },
      },
      { $unwind: { path: '$musicInfo', preserveNullAndEmptyArrays: true } },

      // Final shape 
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
          likeCount: 1,
          commentCount: 1,
          music: 1,
          'musicInfo.song': 1,
          'musicInfo.link': 1,
          'musicInfo.coverImg': 1,
          'musicInfo.author': 1,
          'user._id': 1,
          'user.handleName': 1,
          'user.username': 1,
          'user.profilePic': 1,
        },
      },
    ];
  }

  // charts
  public buildTimeAggregation(
    from: Date,
    to: Date,
    unit: 'day' | 'month',
    matchCondition: Record<string, any> = {},
    dateField: string = 'createdAt'
  ): any[] {
    // Convert UTC dates to Vietnam timezone for grouping
    const groupId = unit === 'day'
      ? { 
          $dateToString: { 
            format: '%Y-%m-%d', 
            date: {
              $dateAdd: {
                startDate: `$${dateField}`,
                unit: 'hour',
                amount: 7
              }
            }
          } 
        }
      : { 
          $month: {
            $dateAdd: {
              startDate: `$${dateField}`,
              unit: 'hour',
              amount: 7
            }
          }
        };

    return [
      { $match: { [dateField]: { $gte: from, $lte: to }, ...matchCondition } },
      { $group: { _id: groupId, count: { $sum: 1 } } },
    ];
  }
  
  public buildTimeSeriesData(
    from: Date,
    to: Date,
    unit: 'day' | 'month',
    dataMaps: Map<string | number, number>[],
    dataKeys: string[]
  ): any[] {
    const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const data = [];

    if (unit === 'day') {
      // Convert UTC dates to Vietnam timezone for consistent key generation
      const fromVN = new Date(from.getTime() + 7 * 60 * 60 * 1000);
      const toVN = new Date(to.getTime() + 7 * 60 * 60 * 1000);
      
      const days = Math.floor((toVN.getTime() - fromVN.getTime()) / 86400_000) + 1;
      for (let i = 0; i < days; i++) {
        const d = new Date(fromVN.getTime() + i * 86400_000);
        const key = d.toISOString().slice(0, 10); // This will match the aggregation key
        const period = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
        
        const entry = { period };
        dataKeys.forEach((dataKey, index) => {
          entry[dataKey] = dataMaps[index].get(key) ?? 0;
        });
        data.push(entry);
      }
    } else {
      const toVN = new Date(to.getTime() + 7 * 60 * 60 * 1000);
      const current = toVN.getMonth() + 1;
      for (let m = 1; m <= current; m++) {
        const entry = { period: monthLabels[m-1] };
        dataKeys.forEach((dataKey, index) => {
          entry[dataKey] = dataMaps[index].get(m) ?? 0;
        });
        data.push(entry);
      }
    }

    return data;
  }

  // core all posts/reels 
  public buildBasePipeline(
    currentUser: Types.ObjectId,
    matchFilter: Record<string, any>,
  ): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'relations',
          let: { pu: '$userID', cu: currentUser },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userOneID', '$$cu'] },
                    { $eq: ['$userTwoID', '$$pu'] },
                  ],
                },
              },
            },
            { $project: { _id: 0, relCurToAuth: '$relation' } },
          ],
          as: 'relCurToAuthArr',
        },
      },
      {
        $addFields: {
          relCurToAuth: {
            $ifNull: [
              { $arrayElemAt: ['$relCurToAuthArr.relCurToAuth', 0] },
              '',
            ],
          },
        },
      },

      //
      // 2) lookup where postAuthor -> currentUser
      {
        $lookup: {
          from: 'relations',
          let: { pu: '$userID', cu: currentUser },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userOneID', '$$pu'] },
                    { $eq: ['$userTwoID', '$$cu'] },
                  ],
                },
              },
            },
            { $project: { _id: 0, relAuthToCur: '$relation' } },
          ],
          as: 'relAuthToCurArr',
        },
      },
      {
        $addFields: {
          relAuthToCur: {
            $ifNull: [
              { $arrayElemAt: ['$relAuthToCurArr.relAuthToCur', 0] },
              '',
            ],
          },
        },
      },

      // 3) compute isFollow and isBlocked via regex
      {
        $addFields: {
          isFollow: {
            $or: [
              // current->author “FOLLOW_*”
              {
                $regexMatch: {
                  input: '$relCurToAuth',
                  regex: '^FOLLOW_',
                },
              },
              // author->current “*_FOLLOW”
              {
                $regexMatch: {
                  input: '$relAuthToCur',
                  regex: '_FOLLOW$',
                },
              },
            ],
          },
          isBlocked: {
            $or: [
              // current->author “BLOCK_*”
              {
                $regexMatch: {
                  input: '$relCurToAuth',
                  regex: '^BLOCK_',
                },
              },
              // author->current “*_BLOCK”
              {
                $regexMatch: {
                  input: '$relAuthToCur',
                  regex: '_BLOCK$',
                },
              },
            ],
          },
        },
      },

      // 4) drop temporary fields
      {
        $project: {
          relCurToAuthArr: 0,
          relAuthToCurArr: 0,
          relCurToAuth: 0,
          relAuthToCur: 0,
        },
      },

      // 5) filter out blocked authors
      {
        $match: {
          $expr: {
            $not: [
              {
                $and: [
                  { $ne: ['$userID', currentUser] },
                  { $eq: ['$isBlocked', true] },
                ],
              },
            ],
          },
        },
      },

      {
        $addFields: {
          isFollow: {
            $cond: [
              { $eq: ['$userID', currentUser] },
              '$$REMOVE', // remove field on your own posts
              '$isFollow', // otherwise keep it
            ],
          },
        },
      },
      {
        $project: {
          isBlocked: 0,
        },
      },

      // hidden posts + any extra matching
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
          ...matchFilter,
          isEnable: true,
          nsfw: false,
          $expr: { $not: { $in: [currentUser, '$hidden.userId'] } },
        },
      },

      // 3) top‑level lookups & counts
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
          likeCount: { $size: '$likes' },
          commentCount: { $size: '$comments' },
        },
      },

      // music lookup
      {
        $lookup: {
          from: 'musics',
          localField: 'music.musicId',
          foreignField: '_id',
          as: 'musicInfo',
        },
      },
      { $unwind: { path: '$musicInfo', preserveNullAndEmptyArrays: true } },

      // isLike
      {
        $lookup: {
          from: 'postlikes',
          let: { pid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$postId', '$$pid'] },
                    { $eq: ['$userId', currentUser] },
                  ],
                },
              },
            },
          ],
          as: 'userLikeEntry',
        },
      },
      { $addFields: { isLike: { $gt: [{ $size: '$userLikeEntry' }, 0] } } },

      // bookmarks
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
      {
        $lookup: {
          from: 'bookmarkitems',
          let: { pid: '$_id', pls: '$myPlaylists._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ['$playlistID', '$$pls'] },
                    { $eq: ['$itemID', '$$pid'] },
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
          'musicInfo.song': 1,
          'musicInfo.link': 1,
          'musicInfo.coverImg': 1,
          'musicInfo.author': 1,
          'user._id': 1,
          'user.handleName': 1,
          'user.username': 1,
          'user.profilePic': 1,
          isFollow: 1,
          isBlocked: 1,
          isBookmarked: 1,
        },
      },
    ];
  }
  
  // Build recommendation scoring pipeline stages. can be modified freely for what type of recommendation is needed
  public buildRecommendationStages(
    currentUser: Types.ObjectId,
    userHandleName: string,
    config: RecommendationConfig
  ): PipelineStage[] {
    if (!config.enableRecommendation) {
      return []; // Return empty array if recommendation is disabled
    }

    return [
      // get user's bookmarked music IDs for music recommendations
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
          ],
          as: 'userPlaylists',
        },
      },
      {
        $lookup: {
          from: 'bookmarkitems',
          let: { playlists: '$userPlaylists._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ['$playlistID', '$$playlists'] },
                    { $eq: ['$itemType', 'music'] },
                    { $eq: ['$isDeleted', false] },
                  ],
                },
              },
            },
            { $project: { itemID: 1 } },
          ],
          as: 'bookmarkedMusicItems',
        },
      },

      // Calculate comprehensive recommendation score
      {
        $addFields: {
          recommendationScore: {
            $add: [
              // Score for posts where user is tagged in media
              {
                $multiply: [
                  config.weights.mediaTagged,
                  {
                    $cond: [
                      {
                        $gt: [
                          {
                            $size: {
                              $filter: {
                                input: { $ifNull: ['$media', []] },
                                cond: {
                                  $gt: [
                                    {
                                      $size: {
                                        $filter: {
                                          input: { $ifNull: ['$$this.tags', []] },
                                          cond: { $eq: ['$$this.userId', currentUser] },
                                        },
                                      },
                                    },
                                    0,
                                  ],
                                },
                              },
                            },
                          },
                          0,
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                ],
              },

              // Score for posts where user is mentioned in caption
              {
                $multiply: [
                  config.weights.captionMentioned,
                  {
                    $cond: [
                      {
                        $regexMatch: {
                          input: { $ifNull: ['$caption', ''] },
                          regex: `@${userHandleName}`,
                          options: 'i',
                        },
                      },
                      1,
                      0,
                    ],
                  },
                ],
              },

              // Score for posts from followed users
              {
                $multiply: [
                  config.weights.followedUsers,
                  {
                    $cond: [{ $eq: ['$isFollow', true] }, 1, 0],
                  },
                ],
              },

              // Engagement score (normalized)
              {
                $multiply: [
                  config.weights.engagement,
                  {
                    $add: [
                      { $divide: [{ $ifNull: ['$likeCount', 0] }, 10] },
                      { $multiply: [{ $divide: [{ $ifNull: ['$commentCount', 0] }, 5] }, 1.5] },
                      { $divide: [{ $ifNull: ['$viewCount', 0] }, 100] },
                    ],
                  },
                ],
              },

              // Recency score (exponential decay)
              {
                $multiply: [
                  config.weights.recency,
                  {
                    $let: {
                      vars: {
                        daysDiff: {
                          $divide: [
                            { $subtract: [new Date(), '$createdAt'] },
                            86400000, // milliseconds in a day
                          ],
                        },
                      },
                      in: {
                        $cond: [
                          { $lte: ['$$daysDiff', 1] }, 3, // Posts from today get high score
                          {
                            $cond: [
                              { $lte: ['$$daysDiff', 7] }, 2, // Posts from this week
                              {
                                $cond: [
                                  { $lte: ['$$daysDiff', 30] }, 1, // Posts from this month
                                  0.5, // Older posts get lower score
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    },
                  },
                ],
              },

              // Score for posts with music user has bookmarked
              {
                $multiply: [
                  config.weights.bookmarkedMusic,
                  {
                    $cond: [
                      {
                        $and: [
                          { $ne: ['$music.musicId', null] },
                          {
                            $in: [
                              '$music.musicId',
                              { $map: { input: '$bookmarkedMusicItems', as: 'item', in: '$$item.itemID' } },
                            ],
                          },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                ],
              },
            ],
          },

          // Add metadata for debugging/analytics (optional)
          recommendationMeta: {
            isMediaTagged: {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: { $ifNull: ['$media', []] },
                      cond: {
                        $gt: [
                          {
                            $size: {
                              $filter: {
                                input: { $ifNull: ['$$this.tags', []] },
                                cond: { $eq: ['$$this.userId', currentUser] },
                              },
                            },
                          },
                          0,
                        ],
                      },
                    },
                  },
                },
                0,
              ],
            },
            isCaptionMentioned: {
              $regexMatch: {
                input: { $ifNull: ['$caption', ''] },
                regex: `@${userHandleName}`,
                options: 'i',
              },
            },
            isFromFollowed: { $eq: ['$isFollow', true] },
            hasBookmarkedMusic: {
              $and: [
                { $ne: ['$music.musicId', null] },
                {
                  $in: [
                    '$music.musicId',
                    { $map: { input: '$bookmarkedMusicItems', as: 'item', in: '$$item.itemID' } },
                  ],
                },
              ],
            },
          },
        },
      },

      // add diversity factor if enabled
      ...(config.diversity.enabled
        ? [
            {
              $addFields: {
                diversityFactor: {
                  $multiply: [
                    { $rand: {} },
                    config.diversity.randomFactor || 0.1,
                  ],
                },
              },
            } as PipelineStage,
          ]
        : []),

      // clean up temporary fields
      {
        $project: {
          userPlaylists: 0,
          bookmarkedMusicItems: 0,
        },
      },
    ];
  }

  // recommendation pipeline
  public buildRecommendationSortStages(config: RecommendationConfig): PipelineStage[] {
    if (!config.enableRecommendation) {
      // Default chronological sort
      return [{$sort: { createdAt: -1 as -1, },},];
    }

    const sortOrder: Record<string, 1 | -1> = {
    recommendationScore: -1,
    ...(config.diversity.enabled ? { diversityFactor: -1 } : {}),
    createdAt: -1,
  };

  return [{ $sort: sortOrder }];
  }

  // generic pagination and runner
  public async runPagedAggregation(
    matchFilter: Record<string, any>,
    page: number,
    limit: number,
    sampleSize?: number,
    recommendationConfig?: RecommendationConfig,
  ) {
    const currentUser = new Types.ObjectId(matchFilter._userId);
    const baseMatch = { ...matchFilter };
    delete baseMatch._userId;

    // Get user's handleName if recommendation is enabled
    let userHandleName = '';
    if (recommendationConfig?.enableRecommendation) {
      const user = await this.userModel.findById(currentUser).select('handleName').exec();
      userHandleName = user?.handleName || '';
    }

    // Build base pipeline
    let pipeline = this.buildBasePipeline(currentUser, baseMatch);

    // Add recommendation stages if enabled
    if (recommendationConfig?.enableRecommendation && userHandleName) {
      const recommendationStages = this.buildRecommendationStages(
        currentUser,
        userHandleName,
        recommendationConfig,
      );
      pipeline = [...pipeline, ...recommendationStages];
    }

    // Count total
    const countRes = await this.postModel
      .aggregate([...pipeline, { $count: 'total' }])
      .exec();
    const total = countRes[0]?.total ?? 0;
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    // Build sort and pagination stages
    const defaultSort: PipelineStage = {
      $sort: { createdAt: -1 as -1 },
    };

    const sortStages: PipelineStage[] = recommendationConfig?.enableRecommendation
      ? this.buildRecommendationSortStages(recommendationConfig)
      : [defaultSort];

    const pageStages: PipelineStage[] = [
      ...sortStages,
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];

    if (sampleSize) {
      pageStages.push({ $sample: { size: sampleSize } });
    }

    // Clean up recommendation fields in final projection
    const cleanupStages: PipelineStage[] = recommendationConfig?.enableRecommendation
      ? [
          {
            $project: {
              recommendationScore: 0,
              recommendationMeta: 0,
              diversityFactor: 0,
            },
          },
        ]
      : [];

    // Execute main query
    const items = await this.postModel
      .aggregate([...pipeline, ...pageStages, ...cleanupStages])
      .exec();

    return {
      items,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount: total,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  // default recommendation
  public getDefaultRecommendationConfig(): RecommendationConfig {
    return {
      enableRecommendation: true,
      weights: {
        mediaTagged: 15,        // Highest priority for media tags
        captionMentioned: 12,   // High priority for caption mentions
        followedUsers: 8,       // Medium-high priority for followed users
        engagement: 5,          // Medium priority for engagement
        recency: 10,            // High priority for recency
        bookmarkedMusic: 2,     // Low priority for bookmarked music
      },
      diversity: {
        enabled: true,
        randomFactor: 0.1,
      },
      limits: {
        maxMediaTaggedPosts: 15,
        maxFollowedUserPosts: 25,
      },
    };
  }

  // trending recommendations
  public getTrendingRecommendationConfig(): RecommendationConfig {
    return {
      enableRecommendation: true,
      weights: {
        mediaTagged: 5,
        captionMentioned: 3,
        followedUsers: 2,
        engagement: 15,         // Highest priority for trending
        recency: 8,             // High priority for recent trending
        bookmarkedMusic: 3,
      },
      diversity: {
        enabled: true,
        randomFactor: 0.05,
      },      
      limits: {
        maxMediaTaggedPosts: 15,
        maxFollowedUserPosts: 25,
      },
    };
  }  
}
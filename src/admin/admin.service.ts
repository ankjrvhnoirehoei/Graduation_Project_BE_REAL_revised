import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { WeeklyPostsDto } from 'src/post/dto/weekly-posts.dto';
import { LastTwoWeeksDto } from 'src/post/dto/last-two-weeks.dto';
import { Post, PostDocument } from 'src/post/post.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { Story, StoryDocument } from 'src/story/schema/story.schema';
import { TopFollowerDto } from 'src/user/dto/top-followers.dto';
import { Relation, RelationDocument } from 'src/relation/relation.schema';
import { User, UserDocument } from 'src/user/user.schema';
import { InteractionPoint } from 'src/user/dto/search-user.dto';
import { EditUserDto } from 'src/user/dto/update-user.dto';
import { Comment, CommentDocument } from 'src/comment/comment.schema';
import { PostLike, PostLikeDocument } from 'src/like_post/like_post.schema';
import { ReportUser, ReportUserDocument } from 'src/report-user/report-user.schema';
import { ReportContent, ReportContentDocument } from 'src/report-content/report-content.schema';
import { CommonServices, RangeKey } from './helpers/helpers.service';
import { ReportStory, ReportStoryDocument } from 'src/report-story/schema/report-story.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(Story.name) private storyModel: Model<StoryDocument>,
    @InjectModel(Relation.name) private relationModel: Model<RelationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(PostLike.name) private likeModel: Model<PostLikeDocument>,
    @InjectModel(ReportUser.name) private reportUserModel: Model<ReportUserDocument>,
    @InjectModel(ReportContent.name) private reportContentModel: Model<ReportContentDocument>,
    @InjectModel(ReportStory.name) private reportStoryModel: Model<ReportStoryDocument>,
    private readonly userService: UserService,
    private readonly commonServices: CommonServices,
  ) {}

  public async ensureAdmin(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user || user.role !== 'admin') {
      throw new BadRequestException('Access denied: Admins only.');
    }
  }

  async getWeeklyStats(userId: string): Promise<WeeklyPostsDto[]> {
    await this.ensureAdmin(userId);
    
    const thisMonday = this.commonServices.getMondayOfWeek();
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);
    
    const prevMonday = new Date(thisMonday);
    prevMonday.setDate(thisMonday.getDate() - 7);

    // Get current week and previous week data in parallel
    const [currentWeekRaw, previousWeekRaw] = await Promise.all([
      this.postModel.aggregate(this.commonServices.createWeeklyAggregation(thisMonday, nextMonday)),
      this.postModel.aggregate(this.commonServices.createWeeklyAggregation(prevMonday, thisMonday)),
    ]);

    // Create maps for quick lookup
    const currentWeekMap = new Map<number, number>();
    currentWeekRaw.forEach(r => currentWeekMap.set(r.dayOfWeek, r.count));
    
    const previousWeekMap = new Map<number, number>();
    previousWeekRaw.forEach(r => previousWeekMap.set(r.dayOfWeek, r.count));

    const labels: Record<number, WeeklyPostsDto['day']> = {
      1: 'T2',
      2: 'T3',
      3: 'T4',
      4: 'T5',
      5: 'T6',
      6: 'T7',
      7: 'CN',
    };

    return [1, 2, 3, 4, 5, 6, 7].map(dayNum => {
      const currentCount = currentWeekMap.get(dayNum) ?? 0;
      const previousCount = previousWeekMap.get(dayNum) ?? 0;
      
      const { percentageChange, trend } = this.commonServices.combinedFluct(
        currentCount, 
        previousCount
      );

      return {
        day: labels[dayNum],
        posts: currentCount,
        percentageChange,
        trend,
      };
    });
  }

  async getLastTwoWeeks(userId: string): Promise<LastTwoWeeksDto[]> {
    await this.ensureAdmin(userId);
    
    const thisMonday = this.commonServices.getMondayOfWeek();
    const prevMonday = new Date(thisMonday);
    prevMonday.setDate(thisMonday.getDate() - 7);
    const beforePrevMonday = new Date(thisMonday);
    beforePrevMonday.setDate(thisMonday.getDate() - 14);

    // Run both aggregations in parallel
    const [prevRaw, beforeRaw] = await Promise.all([
      this.postModel.aggregate(this.commonServices.createWeeklyAggregation(prevMonday, thisMonday)),
      this.postModel.aggregate(this.commonServices.createWeeklyAggregation(beforePrevMonday, prevMonday)),
    ]);

    // Create maps for quick lookup
    const prevMap = new Map<number, number>();
    prevRaw.forEach(r => prevMap.set(r.dayOfWeek, r.count));
    const beforeMap = new Map<number, number>();
    beforeRaw.forEach(r => beforeMap.set(r.dayOfWeek, r.count));

    const labels: Record<number, LastTwoWeeksDto['day']> = {
      1: 'T2',
      2: 'T3',
      3: 'T4',
      4: 'T5',
      5: 'T6',
      6: 'T7',
      7: 'CN',
    };

    return [1, 2, 3, 4, 5, 6, 7].map(dayNum => {
      const previousWeekCount = prevMap.get(dayNum) ?? 0;
      const beforePreviousCount = beforeMap.get(dayNum) ?? 0;
      
      const { percentageChange, trend } = this.commonServices.combinedFluct(
        previousWeekCount, 
        beforePreviousCount
      );

      return {
        day: labels[dayNum],
        previousWeek: previousWeekCount,
        beforePrevious: beforePreviousCount,
        percentageChange,
        trend,
      };
    });
  }

  async getTopLiked(userId: string, limit = 10) {
    await this.ensureAdmin(userId);
    
    const firstDayOfMonth = this.commonServices.getFirstDayOfMonth();

    // Create a mock current user ID for the pipeline
    const mockUserId = new Types.ObjectId();
    
    // Use the base pipeline from PostService but with modifications
    const basePipeline = this.commonServices.buildAdminBasePipeline(mockUserId, {
      createdAt: { $gte: firstDayOfMonth }
    });

    const docs = await this.postModel.aggregate([
      ...basePipeline,
      // Sort by like count descending, then by creation date for tie-breaking
      { $sort: { likeCount: -1, createdAt: -1 } },
      { $limit: limit },
    ]);

    return docs.map(d => ({
      ...d,
      id: d._id.toString(),
    }));
  }

  async getContentDistribution(userId: string): Promise<{ type: string; value: number }[]> {
    await this.ensureAdmin(userId);
    
    const [postCount, reelCount, storyCount] = await Promise.all([
      this.postModel.countDocuments({ type: 'post' }),
      this.postModel.countDocuments({ type: 'reel' }),
      this.storyModel.countDocuments({}),
    ]);

    return [
      { type: 'Post', value: postCount },
      { type: 'Reel', value: reelCount },
      { type: 'Story', value: storyCount },
    ];
  }

  async getTwoYearStats(userId: string) {
    await this.ensureAdmin(userId);
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;
    const { startDate, endDate } = this.commonServices.getYearBoundaries(1);

    // Aggregate posts & reels with timezone awareness
    const postRaw = await this.postModel.aggregate(
      this.commonServices.createYearlyAggregation(startDate, endDate, true)
    );

    // Aggregate stories with timezone awareness
    const storyRaw = await this.storyModel.aggregate(
      this.commonServices.createYearlyAggregation(startDate, endDate, false)
    );

    const MONTH_NAMES = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    type Slot = { month: string; posts: number; reels: number; stories: number };
    const makeEmpty = (): Slot[] =>
      MONTH_NAMES.map(m => ({ month: m, posts: 0, reels: 0, stories: 0 }));

    const lastYearStats: Slot[] = makeEmpty();
    const currentYearStats: Slot[] = makeEmpty();

    // fill posts & reels
    for (const { _id: { year, month, type }, count } of postRaw) {
      const arr = year === lastYear ? lastYearStats
                : year === currentYear ? currentYearStats
                : null;
      if (!arr) continue;
      const idx = month - 1;
      if (type === 'post') arr[idx].posts = count;
      else if (type === 'reel') arr[idx].reels = count;
    }

    // fill stories
    for (const { _id: { year, month }, count } of storyRaw) {
      const arr = year === lastYear ? lastYearStats
                : year === currentYear ? currentYearStats
                : null;
      if (!arr) continue;
      arr[month - 1].stories = count;
    }

    // zero-fill future months of current year
    const thisMonth = now.getMonth(); // 0-based
    for (let i = thisMonth + 1; i < 12; i++) {
      currentYearStats[i].posts = 0;
      currentYearStats[i].reels = 0;
      currentYearStats[i].stories = 0;
    }

    // Calculate totals and use existing helper for percentage change
    const sumTotal = (arr: Slot[]) =>
      arr.reduce((s, x) => s + x.posts + x.reels + x.stories, 0);

    const totalLast = sumTotal(lastYearStats);
    const totalCur = sumTotal(currentYearStats);

    // Use existing combinedFluct helper for consistent calculation
    const { percentageChange, trend } = this.commonServices.combinedFluct(totalCur, totalLast);

    const comparison = [
      { 
        currentYear, 
        lastYear, 
        percentageChange, 
        trend: trend === 'no change' ? 'no_change' : trend as 'increase' | 'decrease'
      },
    ];

    return {
      lastYearStats,
      currentYearStats,
      comparison,
    };
  }

async getLastSixMonths(userId: string) {
  await this.ensureAdmin(userId);
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-based; Jan = 0

  // build the 6-month window
  const months: { date: Date; label: string; key: string }[] = [];
  for (let offset = -5; offset <= 0; offset++) {
    const d = new Date(currentYear, currentMonth + offset, 1);
    const yyyy = d.getFullYear();
    const mm = d.getMonth() + 1;     
    const label = d.toLocaleString('en-US', { month: 'short' });
    const key = `${yyyy}-${mm}`;
    months.push({ date: d, label, key });
  }

  const startDate = months[0].date;
  const endDate = new Date(currentYear, currentMonth + 1, 1); // first day of next month

  const postRaw = await this.postModel.aggregate(
    this.commonServices.createYearlyAggregation(startDate, endDate, true)
  );

  const storyRaw = await this.storyModel.aggregate(
    this.commonServices.createYearlyAggregation(startDate, endDate, false)
  );

  // build a map for quick lookup
  type CountTriple = { posts: number; reels: number; stories: number };
  const countsMap: Record<string, CountTriple> = {};

  for (const { _id, count } of postRaw) {
    const key = `${_id.year}-${_id.month}`;
    if (!countsMap[key]) countsMap[key] = { posts: 0, reels: 0, stories: 0 };
    if (_id.type === 'post') countsMap[key].posts = count;
    else if (_id.type === 'reel') countsMap[key].reels = count;
  }

  for (const { _id, count } of storyRaw) {
    const key = `${_id.year}-${_id.month}`;
    if (!countsMap[key]) countsMap[key] = { posts: 0, reels: 0, stories: 0 };
    countsMap[key].stories = count;
  }

  // assemble the array of month-slots
  const yearlyStats = months.map(({ date, label, key }) => {
    const c = countsMap[key] || { posts: 0, reels: 0, stories: 0 };
    return { month: label, posts: c.posts, reels: c.reels, stories: c.stories };
  });

  // human‐readable start/end
  const start = months[0].date.toLocaleString('en-US', {
    month: 'short', year: 'numeric'
  });
  const end = months[months.length - 1].date.toLocaleString('en-US', {
    month: 'short', year: 'numeric'
  });

  // compute totals including stories
  const totals = yearlyStats.map(s => s.posts + s.reels + s.stories);

  // trend detection
  const deltas = totals.slice(1).map((v, i) => v - totals[i]);
  const allNonNeg = deltas.every(d => d >= 0);
  const allNonPos = deltas.every(d => d <= 0);
  const anyPos = deltas.some(d => d > 0);
  const anyNeg = deltas.some(d => d < 0);
  const allEqual = totals.every(v => v === totals[0]);

  let comparison: string;
  if (allEqual) {
    comparison = 'no_change';
  } else if (allNonNeg && anyPos) {
    comparison = 'stable_growth';
  } else if (allNonPos && anyNeg) {
    comparison = 'stable_decline';
  } else {
    const first = totals[0], last = totals[totals.length - 1];
    const middleSpike = totals
      .slice(1, -1)
      .some(v => v >= 2 * Math.max(first, last));
    comparison = middleSpike ? 'spike_middle' : 'volatile';
  }

  return { yearlyStats, start, end, comparison };
}

async compareLastSixMonths(userId: string) {
  await this.ensureAdmin(userId);
  
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based; Jan = 0

  // current window: 6 full months before this month
  const currStart = new Date(year, month - 5, 1);
  const currEnd = new Date(year, month + 1, 1);

  // previous window: the six months before that
  const prevStart = new Date(year, month - 11, 1);
  const prevEnd = new Date(year, month - 5, 1);

  const countPostsAndReels = (from: Date, to: Date) =>
    this.postModel.countDocuments({
      createdAt: { $gte: from, $lt: to },
    });

  const countStories = (from: Date, to: Date) =>
    this.storyModel.countDocuments({
      createdAt: { $gte: from, $lt: to },
    });

  const [
    rawCurrPR, 
    rawPrevPR,
    rawCurrStories, 
    rawPrevStories,
  ] = await Promise.all([
    countPostsAndReels(currStart, currEnd),
    countPostsAndReels(prevStart, prevEnd),
    countStories(currStart, currEnd),
    countStories(prevStart, prevEnd),
  ]);

  const currentTotal = rawCurrPR + rawCurrStories;
  const previousTotal = rawPrevPR + rawPrevStories;

  const { percentageChange, trend } = this.commonServices.combinedFluct(currentTotal, previousTotal);

  // start & end labels
  const startLabel = currStart.toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
  });
  const endMonthDate = new Date(currEnd.getFullYear(), currEnd.getMonth() - 1, 1);
  const endLabel = endMonthDate.toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  return {
    currentTotalPosts: currentTotal,
    previousTotalPosts: previousTotal,
    percentageChange,
    trend: trend === 'no change' ? 'no_change' : trend as 'increase' | 'decrease',
    start: startLabel,
    end: endLabel,
  };
}

  async getPostsSummary(userId: string) {
    await this.ensureAdmin(userId);
        const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); 

    const currStart = new Date(year, month - 5, 1);
    const currEnd   = new Date(year, month + 1, 1);
    const prevStart = new Date(year, month - 11, 1);
    const prevEnd   = new Date(year, month - 5, 1);

    const countWindow = async (from: Date, to: Date) => {
      const total = await this.postModel.countDocuments({
        createdAt: { $gte: from, $lt: to },
      });
      const reported = await this.postModel.countDocuments({
        createdAt: { $gte: from, $lt: to },
        isFlagged: true,
      });
      const removed = await this.postModel.countDocuments({
        createdAt: { $gte: from, $lt: to },
        isEnable: false,
      });
      const resolved = 0; // 
      return { total, reported, removed, resolved };
    };

    // Helper: count "hot" posts with dynamic threshold
    const countHot = async (from: Date, to: Date, totalCount: number) => {
      let threshold = 10;
      let hotCount = 0;
      for (let i = 0; i < 10; i++, threshold += 10) {
        // aggregate per-post like & comment counts in the window
        const pipeline = [
          { $match: { createdAt: { $gte: from, $lt: to } } },
          // join likes
          {
            $lookup: {
              from: 'postlikes',
              localField: '_id',
              foreignField: 'postId',
              as: 'likes',
            },
          },
          // join comments
          {
            $lookup: {
              from: 'comments',
              localField: '_id',
              foreignField: 'postID',
              as: 'comments',
            },
          },
          // compute counts
          {
            $addFields: {
              likeCount:    { $size: '$likes' },
              commentCount: { $size: '$comments' },
            },
          },
          // filter hot
          {
            $match: {
              $or: [
                { likeCount:    { $gte: threshold } },
                { commentCount: { $gte: threshold } },
              ],
            },
          },
          { $count: 'hotCount' },
        ];
        const res = await this.postModel.aggregate(pipeline).exec();
        hotCount = res[0]?.hotCount ?? 0;
        if (hotCount / totalCount <= 0.5) break;
      }
      return hotCount;
    };

    // Gather all counts in parallel
    const [
      currBasic,
      prevBasic,
    ] = await Promise.all([
      countWindow(currStart, currEnd),
      countWindow(prevStart, prevEnd),
    ]);

    const [
      currHot,
      prevHot,
    ] = await Promise.all([
      countHot(currStart, currEnd, currBasic.total),
      countHot(prevStart, prevEnd, prevBasic.total),
    ]);

    // Combine into summaries
    const currSummary = {
      total:    currBasic.total,
      hot:      currHot,
      reported: currBasic.reported,
      removed:  currBasic.removed,
      resolved: currBasic.resolved,
    };
    const prevSummary = {
      total:    prevBasic.total,
      hot:      prevHot,
      reported: prevBasic.reported,
      removed:  prevBasic.removed,
      resolved: prevBasic.resolved,
    };

    // Compute percentage change & trend on total only
    let percentageChange = 0;
    let trend: 'increase' | 'decrease' | 'no_change';
    if (prevSummary.total === 0) {
      if (currSummary.total === 0) {
        trend = 'no_change';
      } else {
        trend = 'increase';
        percentageChange = 100;
      }
    } else {
      const diff = currSummary.total - prevSummary.total;
      percentageChange = Math.round((diff / prevSummary.total) * 100);
      trend = diff > 0
        ? 'increase'
        : diff < 0
          ? 'decrease'
          : 'no_change';
    }

    // Human labels
    const start = currStart.toLocaleString('en-US', {
      month: 'short', year: 'numeric'
    }); 
    const endMonthDate = new Date(currEnd.getFullYear(), currEnd.getMonth() - 1, 1);
    const end = endMonthDate.toLocaleString('en-US', {
      month: 'short', year: 'numeric'
    });

    return {
      currentWindow: currSummary,
      percentageChange,
      trend: trend as 'increase' | 'decrease' | 'no_change',
      start,
      end,
    };
  }

  async getTopFollowers(userId: string, limit = 3): Promise<TopFollowerDto[]> {
    await this.ensureAdmin(userId);
        console.log('=== Starting corrected getTopFollowers ===');
    
    const docs = await this.relationModel.aggregate([
      // Match all relations that contain follow relationships
      {
        $match: {
          $or: [
            { relation: { $regex: /^FOLLOW_/ } },
            { relation: { $regex: /_FOLLOW$/ } } 
          ]
        }
      },
      
      // for mutual follows (FOLLOW_FOLLOW)
      {
        $facet: {
          // Case 1: userOne follows userTwo (FOLLOW_* patterns)
          userOneFollows: [
            {
              $match: {
                relation: { $regex: /^FOLLOW_/ }
              }
            },
            {
              $project: {
                followedUserId: '$userTwoID'
              }
            }
          ],
          
          // Case 2: userTwo follows userOne (*_FOLLOW patterns) 
          userTwoFollows: [
            {
              $match: {
                relation: { $regex: /_FOLLOW$/ }
              }
            },
            {
              $project: {
                followedUserId: '$userOneID'
              }
            }
          ]
        }
      },
      
      // Combine both arrays
      {
        $project: {
          allFollows: {
            $concatArrays: ['$userOneFollows', '$userTwoFollows']
          }
        }
      },
      
      // Unwind to get individual follow relationships
      { $unwind: '$allFollows' },
      
      // Replace root with the follow data
      { $replaceRoot: { newRoot: '$allFollows' } },
      
      // Group by followed user and count
      {
        $group: {
          _id: '$followedUserId',
          followerCount: { $sum: 1 }
        }
      },
      
      { $sort: { followerCount: -1 } },
      { $limit: limit },
      
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      { $unwind: '$userDetails' },
      
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          avatar: '$userDetails.profilePic',
          handle: '$userDetails.handleName',
          fullName: '$userDetails.username',
          followers: '$followerCount'
        }
      }
    ]);
    
    console.log('Corrected result:', JSON.stringify(docs, null, 2));
    
    return docs as TopFollowerDto[];
  }

async getTodayStats(userId: string): Promise<{
  newUsers: string;
  newPosts: string;
  newReports: string;
}> {
  await this.ensureAdmin(userId);
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  const [usersCount, postsCount] = await Promise.all([
    this.userModel.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    this.postModel.countDocuments({ createdAt: { $gte: start, $lt: end } }),
  ]);

  return {
    newUsers: usersCount.toString(),
    newPosts: postsCount.toString(),
    newReports: '0', // TODO: build a reports collection and hookup here
  };
}

async getDailyNewAccounts(userId: string, month: number): Promise<{
  month: string;
  data: { day: number; count: number }[];
  comparison: {
    previousMonth: string;
    currentTotal: number;
    previousTotal: number;
    percentageChange: number;
    trend: 'increase' | 'decrease' | 'no_change';
  };
}> {
  await this.ensureAdmin(userId);
  if (month < 1 || month > 12) {
    throw new BadRequestException('Month must be between 1 and 12');
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const year = month <= currentMonth
    ? now.getFullYear()
    : now.getFullYear() - 1;

  // Calculate previous month and year
  let prevMonth: number;
  let prevYear: number;
  
  if (month === 1) {
    prevMonth = 12;
    prevYear = year - 1;
  } else {
    prevMonth = month - 1;
    prevYear = year;
  }

  // Current month date range
  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0);

  // Previous month date range
  const prevStart = new Date(prevYear, prevMonth - 1, 1, 0, 0, 0);
  const prevEnd = new Date(prevYear, prevMonth, 1, 0, 0, 0);

  // Get current month data
  const raw = await this.userModel.aggregate<{ _id: number; count: number }>([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { $dayOfMonth: '$createdAt' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id': 1 } },
  ]);

  // Get previous month total
  const prevMonthData = await this.userModel.aggregate<{ totalCount: number }>([
    { $match: { createdAt: { $gte: prevStart, $lt: prevEnd } } },
    {
      $group: {
        _id: null,
        totalCount: { $sum: 1 },
      },
    },
  ]);

  // Calculate totals
  const currentTotal = raw.reduce((sum, item) => sum + item.count, 0);
  const previousTotal = prevMonthData[0]?.totalCount || 0;

  // Use existing helper for percentage change & trend calculation
  const { percentageChange, trend } = this.commonServices.combinedFluct(currentTotal, previousTotal);

  // Build full array with zeros where missing
  const lastDay = new Date(year, month, 0).getDate();
  const data = Array.from({ length: lastDay }, (_, i) => {
    const dayNum = i + 1;
    const found = raw.find(r => r._id === dayNum);
    return { day: dayNum, count: found?.count ?? 0 };
  });

  return {
    month: `${year}-${String(month).padStart(2, '0')}`,
    data,
    comparison: {
      previousMonth: `${prevYear}-${String(prevMonth).padStart(2, '0')}`,
      currentTotal,
      previousTotal,
      percentageChange: Math.round(percentageChange * 100) / 100, 
      trend: trend === 'no change' ? 'no_change' : trend as 'increase' | 'decrease',
    },
  };
}

async getInteractionChartForUser(userId: Types.ObjectId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); 
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  // Calculate previous month
  let prevMonth: number;
  let prevYear: number;
  
  if (month === 0) { // January (month 0)
    prevMonth = 11; // December
    prevYear = year - 1;
  } else {
    prevMonth = month - 1;
    prevYear = year;
  }

  const prevStart = new Date(prevYear, prevMonth, 1);
  const prevEnd = new Date(prevYear, prevMonth + 1, 1);

  // aggregate daily counts for a model 
  const aggregateDaily = async (
    model: Model<any>,
    typeMatch?: Record<string, any>
  ): Promise<InteractionPoint[]> => {
    const match: any = {
      createdAt: { $gte: start, $lt: end },
      ...(typeMatch || {}),
    };
    const raw = await model
      .aggregate<{ _id: number; count: number }>([
        { $match: match },
        {
          $group: {
            _id: { $dayOfMonth: '$createdAt' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id': 1 } },
      ])
      .exec();

    return raw.map(r => ({ day: r._id, count: r.count }));
  };

  // aggregate total counts for previous month
  const aggregateMonthTotal = async (
    model: Model<any>,
    typeMatch?: Record<string, any>
  ): Promise<number> => {
    const match: any = {
      createdAt: { $gte: prevStart, $lt: prevEnd },
      ...(typeMatch || {}),
    };
    const result = await model
      .aggregate<{ totalCount: number }>([
        { $match: match },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
          },
        },
      ])
      .exec();

    return result[0]?.totalCount || 0;
  };

  // get daily post counts (current month)
  const rawPosts = await aggregateDaily(this.postModel, {
    userID: userId,
    type: { $in: ['post', 'reel'] },
  });
  
  // get daily story counts (current month)
  const rawStories = await aggregateDaily(this.storyModel, {
    ownerId: userId,
  });

  // get previous month totals
  const prevPostsTotal = await aggregateMonthTotal(this.postModel, {
    userID: userId,
    type: { $in: ['post', 'reel'] },
  });
  
  const prevStoriesTotal = await aggregateMonthTotal(this.storyModel, {
    ownerId: userId,
  });

  // calculate current month totals
  const currentPostsTotal = rawPosts.reduce((sum, item) => sum + item.count, 0);
  const currentStoriesTotal = rawStories.reduce((sum, item) => sum + item.count, 0);

  // Use existing helper for percentage changes
  const postsComparison = this.commonServices.combinedFluct(currentPostsTotal, prevPostsTotal);
  const storiesComparison = this.commonServices.combinedFluct(currentStoriesTotal, prevStoriesTotal);

  // number of days in this month
  const lastDay = new Date(year, month + 1, 0).getDate();

  // bucket into 4 weeks
  const weeks = Array.from({ length: 4 }, (_, i) => ({
    week: `Week ${i+1}`,
    post: 0,
    story: 0,
  }));

  const accumulate = (raw: InteractionPoint[], field: 'post'|'story') =>
    raw.forEach(({ day, count }) => {
      const idx = Math.min(3, Math.floor((day - 1) / 7));
      weeks[idx][field] += count;
    });

  accumulate(rawPosts,  'post');
  accumulate(rawStories,'story');

  return {
    weeks,
    comparison: {
      currentMonth: `${year}-${String(month + 1).padStart(2, '0')}`,
      previousMonth: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`,
      posts: {
        current: currentPostsTotal,
        previous: prevPostsTotal,
        percentageChange: Math.round(postsComparison.percentageChange * 100) / 100,
        trend: postsComparison.trend
      },
      stories: {
        current: currentStoriesTotal,
        previous: prevStoriesTotal,
        percentageChange: Math.round(storiesComparison.percentageChange * 100) / 100,
        trend: storiesComparison.trend
      }
    }
  };
}
  
async searchUsers(userId: string, handleName: string) {
    await this.ensureAdmin(userId);
    const trimmed = handleName.trim();
    if (!trimmed) {
      throw new BadRequestException('handleName cannot be empty');
    }

    // case‐sensitive exact match
    const user = await this.userModel
      .findOne({ handleName: { $regex: `^${trimmed}$`, $options: 's' } })
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException(`User "${trimmed}" not found`);
    }

    // sanitize
    const clean: any = {
      _id:        user._id,
      username:   user.username,
      email:      user.email || '',
      phoneNumber:user.phoneNumber || '',
      handleName: user.handleName,
      bio:        user.bio || '',
      address:    user.address || '',
      gender:     user.gender || '',
      profilePic: user.profilePic || '',
      isVip:      user.isVip,
      deletedAt:  user.deletedAt || false,
    };

    // attach interaction chart + comparison
    const interactionData = await this.getInteractionChartForUser(
      user._id as Types.ObjectId
    );
    clean.interactionChartData = interactionData.weeks;
    clean.monthlyComparison      = interactionData.comparison;

    return clean;
  }

  async getRecommendedUsers(userId: string, page = 1, limit = 20) {
    await this.ensureAdmin(userId);
        const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNext = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // count total users for pagination
    const totalCount = await this.userModel.countDocuments();

    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;

    const users = await this.userModel
      .aggregate([
        // lookup this month's posts count
        {
          $lookup: {
            from: this.postModel.collection.name,
            let: { uid: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$userID', '$$uid'] },
                      { $in: ['$type', ['post', 'reel']] },
                      { $gte: ['$createdAt', startOfMonth] },
                      { $lt: ['$createdAt', startOfNext] },
                    ],
                  },
                },
              },
              { $count: 'count' },
            ],
            as: 'postAgg',
          },
        },
        // lookup this month's stories count
        {
          $lookup: {
            from: this.storyModel.collection.name,
            let: { uid: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$ownerId', '$$uid'] },
                      { $gte: ['$createdAt', startOfMonth] },
                      { $lt: ['$createdAt', startOfNext] },
                    ],
                  },
                },
              },
              { $count: 'count' },
            ],
            as: 'storyAgg',
          },
        },
        // compute contributions = (postAgg[0].count || 0) + (storyAgg[0].count || 0)
        {
          $addFields: {
            contributions: {
              $add: [
                { $ifNull: [{ $arrayElemAt: ['$postAgg.count', 0] }, 0] },
                { $ifNull: [{ $arrayElemAt: ['$storyAgg.count', 0] }, 0] },
              ],
            },
          },
        },
        // sort: deletedAt false first, then contributions desc, then isVip desc
        {
          $sort: {
            deletedAt: 1,
            contributions: -1,
            isVip: -1,
          },
        },
        // project fields
        {
          $project: {
            _id:       1,
            username:  1,
            handleName:1,
            profilePic:1,
          },
        },
        // paginate
        { $skip: skip },
        { $limit: limit },
      ])
      .exec();

    return {
      data: users,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }  

  async editAccount(userId: string, dto: EditUserDto) {
    await this.ensureAdmin(userId);
    return this.userService.updateProfile(userId, dto);
  }

  async getDashboardStats(userId: string, RangePair: 'default' | '7days' | '30days' | 'year') {
    await this.ensureAdmin(userId);
    const { current, previous } = this.commonServices.getRanges(RangePair);

    // New users
    const [ usersCurr, usersPrev ] = await Promise.all([
      this.userModel.countDocuments({ createdAt: { $gte: current.start, $lte: current.end } }),
      this.userModel.countDocuments({ createdAt: { $gte: previous.start, $lte: previous.end } }),
    ]);

    // New content = posts + stories
    const [ postsCurr, postsPrev, storiesCurr, storiesPrev ] = await Promise.all([
      this.postModel.countDocuments({ createdAt: { $gte: current.start, $lte: current.end } }),
      this.postModel.countDocuments({ createdAt: { $gte: previous.start, $lte: previous.end } }),
      this.storyModel.countDocuments({ createdAt: { $gte: current.start, $lte: current.end } }),
      this.storyModel.countDocuments({ createdAt: { $gte: previous.start, $lte: previous.end } }),
    ]);
    const contentsCurr = postsCurr + storiesCurr;
    const contentsPrev = postsPrev + storiesPrev;

    // Views
    const [ viewsPostCurr, viewsPostPrev ] = await Promise.all([
      this.postModel.aggregate([
        { $match: { createdAt: { $gte: current.start, $lte: current.end } } },
        { $group: { _id: null, sum: { $sum: '$viewCount' } } },
      ]),
      this.postModel.aggregate([
        { $match: { createdAt: { $gte: previous.start, $lte: previous.end } } },
        { $group: { _id: null, sum: { $sum: '$viewCount' } } },
      ]),
    ]);
    const [ viewsStoryCurr, viewsStoryPrev ] = await Promise.all([
      this.storyModel.aggregate([
        { $match: { createdAt: { $gte: current.start, $lte: current.end } } },
        { 
          $project: { 
            count: { 
              $size: { 
                $ifNull: [ '$viewedByUsers', [] ] 
              } 
            } 
          } 
        },
        { $group: { _id: null, sum: { $sum: '$count' } } },
      ]),
      this.storyModel.aggregate([
        { $match: { createdAt: { $gte: previous.start, $lte: previous.end } } },
        { 
          $project: { 
            count: { 
              $size: { 
                $ifNull: [ '$viewedByUsers', [] ] 
              } 
            } 
          } 
        },
        { $group: { _id: null, sum: { $sum: '$count' } } },
      ]),
    ]);
    const viewsCurr = (viewsPostCurr[0]?.sum || 0) + (viewsStoryCurr[0]?.sum || 0);
    const viewsPrev = (viewsPostPrev[0]?.sum || 0) + (viewsStoryPrev[0]?.sum || 0);

    // Comments
    const [ commCurr, commPrev ] = await Promise.all([
      this.commentModel.countDocuments({ createdAt: { $gte: current.start, $lte: current.end } }),
      this.commentModel.countDocuments({ createdAt: { $gte: previous.start, $lte: previous.end } }),
    ]);

    // sum up current & previous totals
    const currTotal = usersCurr + contentsCurr + viewsCurr + commCurr;
    const prevTotal = usersPrev + contentsPrev + viewsPrev + commPrev;

    // build fluctuation
    const { percentageChange, trend } = this.commonServices.combinedFluct(currTotal, prevTotal);

    // return with formatted dates and combined fluctuation
    return {
      users:    usersCurr,
      contents: contentsCurr,
      views:    viewsCurr,
      comments: commCurr,
      fluctuation: { 
        percentageChange, 
        trend 
      },
      period: {
        from: this.commonServices.formatDate(current.start),
        to:   this.commonServices.formatDate(current.end),
      }
    };
  }  

  async getNewPostsByDatePaginated(
    adminId: string,
    from: Date,
    to: Date,
    sortBy: 'createdAt' | 'likeCount' | 'commentCount' | 'viewCount' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
    page: number = 1,
    limit: number = 20,
  ) {
    await this.ensureAdmin(adminId);

    const mockUserId = new Types.ObjectId();
    const skip = (page - 1) * limit;

    // Base pipeline for counting
    const countPipeline = this.commonServices.buildAdminBasePipeline(
      mockUserId,
      {
        createdAt: { $gte: from, $lte: to }
      }
    );

    // Get total count
    const countResult = await this.postModel.aggregate([
      ...countPipeline,
      { $count: 'total' }
    ]);
    const totalCount = countResult[0]?.total || 0;

    // Base pipeline for data
    const dataPipeline = this.commonServices.buildAdminBasePipeline(
      mockUserId,
      {
        createdAt: { $gte: from, $lte: to }
      }
    );

    // Additional stages for pagination and sorting
    const paginationPipeline: PipelineStage[] = [
      {
        $sort: {
          [sortBy]: sortOrder === 'desc' ? -1 : 1,
          ...(sortBy !== 'createdAt' && { createdAt: -1 }),
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    // Execute aggregation
    const docs = await this.postModel.aggregate([
      ...dataPipeline,
      ...paginationPipeline,
    ]);

    // Transform _id to string for consistency
    const posts = docs.map(doc => ({
      ...doc,
      _id: doc._id.toString(),
    }));

    return {
      posts,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1,
    };
  }

  async getCumulativeNewUsers(
    adminId: string,
    range: RangeKey,
  ): Promise<{
    range: RangeKey;
    unit: 'day' | 'month';
    from: string;
    to: string;
    data: Array<{ period: string; accounts: number; cumulative: number }>;
  }> {
    await this.ensureAdmin(adminId);
    const { from, to, unit } = this.commonServices.buildRange(range);

    const raw = await this.userModel.aggregate(
      this.commonServices.buildTimeAggregation(from, to, unit)
    );

    const map = new Map<string | number, number>(raw.map(d => [d._id, d.count]));
    const data = this.commonServices.buildTimeSeriesData(from, to, unit, [map], ['accounts']);
    
    let cumulative = 0;
    data.forEach(entry => {
      cumulative += entry.accounts;
      entry.cumulative = cumulative;
    });

    return { 
      range, 
      unit, 
      from: this.commonServices.formatDate(from), 
      to: this.commonServices.formatDate(to), 
      data 
    };
  }

  async getContentActivity(
    adminId: string,
    range: RangeKey,
  ): Promise<{
    range: RangeKey;
    unit: 'day' | 'month';
    from: string;
    to: string;
    data: Array<{ period: string; posts: number; reels: number; stories: number }>;
  }> {
    await this.ensureAdmin(adminId);
    const { from, to, unit } = this.commonServices.buildRange(range);

    const [postsRaw, reelsRaw, storiesRaw] = await Promise.all([
      this.postModel.aggregate(
        this.commonServices.buildTimeAggregation(from, to, unit, { type: 'post' })
      ),
      this.postModel.aggregate(
        this.commonServices.buildTimeAggregation(from, to, unit, { type: 'reel' })
      ),
      this.storyModel.aggregate(
        this.commonServices.buildTimeAggregation(from, to, unit)
      ),
    ]);

    const dataMaps = [
      new Map(postsRaw.map(d => [d._id, d.count])),
      new Map(reelsRaw.map(d => [d._id, d.count])),
      new Map(storiesRaw.map(d => [d._id, d.count]))
    ];

    const data = this.commonServices.buildTimeSeriesData(from, to, unit, dataMaps, ['posts', 'reels', 'stories']);

    return { 
      range, 
      unit, 
      from: this.commonServices.formatDate(from), 
      to: this.commonServices.formatDate(to), 
      data 
    };
  }

  async getEngagementActivity(
    adminId: string,
    range: RangeKey,
  ): Promise<{
    range: RangeKey;
    unit: 'day' | 'month';
    from: string;
    to: string;
    data: Array<{ period: string; likes: number; comments: number; follows: number }>;
  }> {
    await this.ensureAdmin(adminId);
    const { from, to, unit } = this.commonServices.buildRange(range);

    const [likesRaw, commentsRaw, followsRaw] = await Promise.all([
      this.likeModel.aggregate(
        this.commonServices.buildTimeAggregation(from, to, unit)
      ),
      this.commentModel.aggregate(
        this.commonServices.buildTimeAggregation(from, to, unit, { isDeleted: false })
      ),
      this.relationModel.aggregate([
        ...this.commonServices.buildTimeAggregation(from, to, unit, {}, 'updated_at').slice(0, 1),
        { 
          $addFields: { 
            followCount: {
              $switch: {
                branches: [
                  { case: { $eq: ['$relation', 'FOLLOW_FOLLOW'] }, then: 2 },
                  { case: { $eq: ['$relation', 'FOLLOW_NULL'] }, then: 1 },
                  { case: { $eq: ['$relation', 'FOLLOW_BLOCK'] }, then: 1 },
                  { case: { $eq: ['$relation', 'BLOCK_FOLLOW'] }, then: 1 },
                  { case: { $eq: ['$relation', 'NULL_FOLLOW'] }, then: 1 },
                ],
                default: 0
              }
            }
          } 
        },
        { 
          $group: { 
            _id: unit === 'day' 
              ? { $dateToString: { format: '%Y-%m-%d', date: '$updated_at' } }
              : { $month: '$updated_at' }, 
            count: { $sum: '$followCount' } 
          } 
        },
      ]),
    ]);

    const dataMaps = [
      new Map(likesRaw.map(d => [d._id, d.count])),
      new Map(commentsRaw.map(d => [d._id, d.count])),
      new Map(followsRaw.map(d => [d._id, d.count]))
    ];

    const data = this.commonServices.buildTimeSeriesData(from, to, unit, dataMaps, ['likes', 'comments', 'follows']);

    return { 
      range, 
      unit, 
      from: this.commonServices.formatDate(from), 
      to: this.commonServices.formatDate(to), 
      data 
    };
  }

  async getStoryActivity(
    adminId: string,
    range: RangeKey,
  ): Promise<{
    success: boolean;
    range: RangeKey;
    unit: 'day' | 'month';
    from: string;
    to: string;
    data: Array<{ period: string; stories: number; views: number }>;
  }> {
    await this.ensureAdmin(adminId);
    const { from, to, unit } = this.commonServices.buildRange(range);

    const [storiesRaw, viewsRaw] = await Promise.all([
      this.storyModel.aggregate(
        this.commonServices.buildTimeAggregation(from, to, unit)
      ),
      this.storyModel.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: unit === 'day'
              ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
              : { $month: '$createdAt' },
            count: { $sum: '$viewCount' }
          }
        },
      ]),
    ]);

    const dataMaps = [
      new Map(storiesRaw.map(d => [d._id, d.count])),
      new Map(viewsRaw.map(d => [d._id, d.count]))
    ];

    const data = this.commonServices.buildTimeSeriesData(from, to, unit, dataMaps, ['stories', 'views']);

    return {
      success: true,
      range,
      unit,
      from: this.commonServices.formatDate(from),
      to: this.commonServices.formatDate(to),
      data
    };
  }

  async getStorySummaryWithTrends(
    adminId: string,
  ): Promise<{
    success: boolean;
    currentWindow: {
      active: number;
      reported: number;
      flagged: number;
      disabled: number;
      total: number;
    };
    percentageChange: number;
    trend: 'increase' | 'decrease' | 'no_change';
    start: string;
    end: string;
  }> {
    await this.ensureAdmin(adminId);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const currStart = new Date(year, month - 5, 1);
    const currEnd = new Date(year, month + 1, 1);
    const prevStart = new Date(year, month - 11, 1);
    const prevEnd = new Date(year, month - 5, 1);

    const countWindow = async (from: Date, to: Date) => {
      const [total, active, reported, flagged, disabled] = await Promise.all([
        this.storyModel.countDocuments({ createdAt: { $gte: from, $lt: to } }),
        this.storyModel.countDocuments({
          createdAt: { $gte: from, $lt: to },
          isEnable: true,
          isFlagged: false
        }),
        this.reportStoryModel.countDocuments({ createdAt: { $gte: from, $lt: to } }),
        this.storyModel.countDocuments({
          createdAt: { $gte: from, $lt: to },
          isFlagged: true
        }),
        this.storyModel.countDocuments({
          createdAt: { $gte: from, $lt: to },
          isEnable: false
        }),
      ]);
      return { total, active, reported, flagged, disabled };
    };

    const [currWindow, prevWindow] = await Promise.all([
      countWindow(currStart, currEnd),
      countWindow(prevStart, prevEnd),
    ]);

    const { percentageChange, trend } = this.commonServices.combinedFluct(currWindow.total, prevWindow.total);

    const start = currStart.toLocaleString('en-US', {
      month: 'short', year: 'numeric'
    });
    const endMonthDate = new Date(currEnd.getFullYear(), currEnd.getMonth() - 1, 1);
    const end = endMonthDate.toLocaleString('en-US', {
      month: 'short', year: 'numeric'
    });

    return {
      success: true,
      currentWindow: currWindow,
      percentageChange,
      trend: trend === 'no change' ? 'no_change' : trend as 'increase' | 'decrease',
      start,
      end,
    };
  }

  async getStorySummary(
    adminId: string,
  ): Promise<{
    success: boolean;
    data: {
      active: number;
      flagged: number;
      disabled: number;
      total: number;
    };
  }> {
    await this.ensureAdmin(adminId);

    const [active, flagged, disabled, total] = await Promise.all([
      this.storyModel.countDocuments({ isEnable: true, isFlagged: false }),
      this.storyModel.countDocuments({ isFlagged: true }),
      this.storyModel.countDocuments({ isEnable: false }),
      this.storyModel.countDocuments({})
    ]);

    return {
      success: true,
      data: {
        active,
        flagged,
        disabled,
        total
      }
    };
  }

  async getStoryEngagement(
    adminId: string,
    range: RangeKey,
  ): Promise<{
    success: boolean;
    data: Array<{ category: string; value: number }>;
  }> {
    await this.ensureAdmin(adminId);
    const { from, to } = this.commonServices.buildRange(range);

    const [interactions, views, shares] = await Promise.all([
      // Count total likes on stories
      this.storyModel.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $project: { likeCount: { $size: '$likedByUsers' } } },
        { $group: { _id: null, total: { $sum: '$likeCount' } } }
      ]),
      // Count total views
      this.storyModel.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: null, total: { $sum: '$viewCount' } } }
      ]),
      Promise.resolve([{ total: 0 }])
    ]);

    return {
      success: true,
      data: [
        { category: 'Tương tác', value: interactions[0]?.total || 0 },
        { category: 'Lượt xem', value: views[0]?.total || 0 },
        { category: 'Chia sẻ', value: shares[0]?.total || 0 },
      ]
    };
  }

}
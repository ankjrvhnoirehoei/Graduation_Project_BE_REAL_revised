import { Injectable } from '@nestjs/common';

import { PipelineStage, Types } from 'mongoose';
import { WeeklyPostsDto } from 'src/post/dto/weekly-posts.dto';
export type RangePair = { start: Date; end: Date };
export type RangeKey = '7days' | '30days' | 'year';

@Injectable()
export class CommonServices {
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
}
import { AbstractRepository } from "@app/common";
import { Story as StoryDocument, StoryType } from "./schema/story.schema";
import { Injectable, Logger } from "@nestjs/common";
import { Model, Types } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class StoryRepository extends AbstractRepository<StoryDocument> {
  protected readonly logger = new Logger(StoryRepository.name);

  constructor(
    @InjectModel(StoryDocument.name)
    storyModel: Model<StoryDocument>,
  ) {
    super(storyModel);
  }
  // THIS ONE IS FOR ARCHIVING STORIES AFTER 24 HOURS
  @Cron(CronExpression.EVERY_HOUR)
  async handleArchiveStories() {
    const now = new Date();
    const expiredDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const result = await this.model.updateMany(
      { isArchived: false, createdAt: { $lte: expiredDate } },
      { $set: { isArchived: true } }
    );
    this.logger.log(`Archived ${result.modifiedCount} stories at ${now.toISOString()}`);
  }

  async findAll() {
    return this.find({});
  }

  async createStory(storyDto: any) {
    return this.create({
      ...storyDto,
    });
  }

  async updateStory(storyId: Types.ObjectId, storyDto: any) {
    return this.findOneAndUpdate(
      { _id: storyId },
      {
        ...storyDto,
      }
    );
  }

  async findUserWorkingStories(userId: Types.ObjectId) {
    return this.find({
      ownerId: userId,
      type: StoryType.STORIES,
      isArchived: false,
    });
  }

  async findUserStories(userId: Types.ObjectId) {
    return this.find({
      ownerId: userId,
      type: StoryType.STORIES,
    });
  }

  async findAllUserHighlights(userId: Types.ObjectId) {
    return this.find({
      ownerId: userId,
      type: StoryType.HIGHLIGHTS,
    });
  }

  async findUserHighlights(id: Types.ObjectId, userId: Types.ObjectId) {
    return this.findOne({
      _id: id,
      ownerId: userId,
      type: StoryType.HIGHLIGHTS,
    });
  }

  async findStoriesByIds(ids: Types.ObjectId[]) {
    return this.find({
      _id: { $in: ids },
      type: StoryType.STORIES
    });
  }

  async findFollowingStories(userIds: Types.ObjectId[]) {
    return this.find({
      ownerId: { $in: userIds },
      type: StoryType.STORIES,
      isArchived: false
    });
  }

  async addViewer(storyId: Types.ObjectId, userId: Types.ObjectId) {
    return this.findOneAndUpdate(
      { _id: storyId },
      { $addToSet: { viewedByUsers: userId } }
    );
  }

  async toggleLike(storyId: Types.ObjectId, userId: Types.ObjectId) {
    return this.findOneAndUpdate(
      { _id: storyId },
      [
        {
          $set: {
            likedByUsers: {
              $cond: [
                { $in: [userId, "$likedByUsers"] },
                { $setDifference: ["$likedByUsers", [userId]] },
                { $concatArrays: ["$likedByUsers", [userId]] }
              ]
            }
          }
        }
      ]
    );
  }

  async deleteStory(storyId: Types.ObjectId) {
    return this.findOneAndDelete({ _id: storyId });
  }

  // Admin methods
  async updateViewCount(storyId: Types.ObjectId) {
    return this.findOneAndUpdate(
      { _id: storyId },
      { $inc: { viewCount: 1 } }
    );
  }

  async flagStory(storyId: Types.ObjectId, isFlagged: boolean = true) {
    return this.findOneAndUpdate(
      { _id: storyId },
      { isFlagged }
    );
  }

  async enableDisableStory(storyId: Types.ObjectId, isEnable: boolean) {
    return this.findOneAndUpdate(
      { _id: storyId },
      { isEnable }
    );
  }

  async getStoriesWithPagination(
    filter: any = {},
    page: number = 1,
    limit: number = 10,
    sort: any = { createdAt: -1 }
  ) {
    const skip = (page - 1) * limit;
    
    const [stories, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('ownerId', 'username handleName profilePic')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter)
    ]);

    return {
      data: stories,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    };
  }

  async searchStories(keyword: string, page: number = 1, limit: number = 10) {
    const filter = {
      $or: [
        { 'content.text': { $regex: keyword, $options: 'i' } },
        { collectionName: { $regex: keyword, $options: 'i' } }
      ]
    };

    return this.getStoriesWithPagination(filter, page, limit);
  }
}
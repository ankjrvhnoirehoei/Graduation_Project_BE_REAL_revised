import { AbstractRepository } from "@app/common";
import { Story as StoryDocument } from "./schema/story.schema";
import { Injectable, Logger } from "@nestjs/common";
import { Model, Types } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";

@Injectable()
export class StoryRepository extends AbstractRepository<StoryDocument> {
  protected readonly logger = new Logger(StoryRepository.name);

  constructor(
    @InjectModel(StoryDocument.name)
    storyModel: Model<StoryDocument>,
  ) {
    super(storyModel);
  }

  async findAll() {
    return this.find({});
  }

  async createStory(storyDto: any) {
    return this.create({
      ...storyDto,
      type: storyDto.type,
      collectionName: storyDto.collectionName ?? '' ,
      storyId: storyDto.storyId ?? [],
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

  async findUserStories(userId: Types.ObjectId, isArchived = false) {
    return this.find({
      ownerId: userId,
      type: 'stories',
      isArchived
    });
  }

  async findUserHighlights(userId: Types.ObjectId) {
    return this.find({
      ownerId: userId,
      type: 'highlights'
    });
  }

  async findStoriesByIds(ids: Types.ObjectId[]) {
    return this.find({
      _id: { $in: ids }
    });
  }

  async findFollowingStories(userIds: Types.ObjectId[]) {
    return this.find({
      ownerId: { $in: userIds },
      type: 'stories',
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
}
import { Injectable } from '@nestjs/common';
import { CreateStoryDto } from './dto/create-story.dto';
import { StoryRepository } from './story.repository';
import { Types } from 'mongoose';
import { CreateHighlightDto } from './dto/create-hightlight.dto';
import { RelationService } from 'src/relation/relation.service';

@Injectable()
export class StoryService {
  constructor(
    private readonly storyRepo: StoryRepository,
    private readonly relationService: RelationService,
  ) {}

  async findAll(uId: string) { 
    return this.storyRepo.find({
      userId: new Types.ObjectId(uId)
    }); 
  }
  async findAllHighlights(uId: string) {
    return this.storyRepo.find({
      userId: new Types.ObjectId(uId),
      type: 'highlight'
    })
  }

  async findFollowingStories(userId: string) {
    // const relations = await this.relationService.findByUserAndFilter(userId, 'following');
    // const followerIds = relations.map(relation =>
    //   relation.userOneID.toString() === userId? relation.userTwoID : relation.userOneID
    // );
    // return this.storyRepo.find({
    //   userId: { $in: followerIds },
    //   expiresAt: { $gt: new Date() },
    //   isArchived: false
    // });
  }

  async create(createStoryDto: CreateStoryDto) {
    // const expiresAt = new Date();
    // expiresAt.setHours(expiresAt.getHours() + 24); // Story hết hạn sau 24h
    return this.storyRepo.create({
      ...createStoryDto,
      userId: new Types.ObjectId(createStoryDto.userId),
      viewsCount: 0,
      isArchived: false,
      type: 'story',
      collectionName: '',
      storyId: [],
      viewerId: [],
    });
  }

  async createHighlight(CreateHighlightDto: CreateHighlightDto) {
    const uId = new Types.ObjectId(CreateHighlightDto.userId);
    const user = await this.storyRepo.find({userId: uId});
    return this.storyRepo.create({
      ...CreateHighlightDto,
      userId: uId,
      viewsCount: 0,
      isArchived: true,
      type: 'highlight',
      mediaUrl: '',
      viewerId: []
    });
  }

  // async getFollowersStories(userId: string) {
  //   // Lấy danh sách người theo dõi
  //   const relations = await this.relationService.findByUserAndFilter(userId, 'followers');
  //   const followerIds = relations.map(relation => 
  //     relation.userOneID.toString() === userId ? relation.userTwoID : relation.userOneID
  //   );

  //   // Lấy stories của followers còn hiệu lực
  //   return this.storyRepo.find({
  //     userId: { $in: followerIds },
  //     expiresAt: { $gt: new Date() },
  //     isArchived: false
  //   });
  // }

  // async getUserStories(userId: string) {
  //   return this.storyRepo.find({
  //     userId: new Types.ObjectId(userId),
  //     expiresAt: { $gt: new Date() },
  //     isArchived: false
  //   });
  // }

  // async addView(storyId: string, viewerId: string) {
  //   const story = await this.storyRepo.findOne({ _id: new Types.ObjectId(storyId) });
  //   if (!story) {
  //     throw new NotFoundException('Story not found');
  //   }

  //   // Tăng số lượt xem
  //   story.viewsCount = (story.viewsCount as number) + 1;
  //   await this.storyRepo.findOneAndUpdate(
  //     { _id: story._id },
  //     { viewsCount: story.viewsCount }
  //   );

  //   return story;
  // }
}

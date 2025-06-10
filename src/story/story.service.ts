import { Injectable, Logger } from '@nestjs/common';
import { CreateStoryDto } from './dto/create-story.dto';
import { StoryRepository } from './story.repository';
import { Types } from 'mongoose';
import { CreateHighlightStoryDto } from './dto/create-highlight.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { RelationService } from 'src/relation/relation.service';
import { UserService } from 'src/user/user.service';
import { UpdateHighlightDto } from './dto/update-highlight.dto';
import { Story, StoryType } from './schema/story.schema';

@Injectable()
export class StoryService {
  private readonly logger: Logger = new Logger();
  constructor(
    private readonly storyRepo: StoryRepository,
    private readonly relationServ: RelationService,
    private readonly userService: UserService,
  ) {}

  // Standardize for Stories and Highlight
  private LIMIT_HIGHLIGHTS = 50
  private LIMIT_PAGINATION = 20
  private STORY_RESPONSE(story: Story) {
    return {
      _id: story._id,
      ownerId: story.ownerId,
      mediaUrl: story.mediaUrl,
      views: story.viewedByUsers,
      likes: story.likedByUsers,
      ...(story.type === StoryType.HIGHLIGHTS && {
        collectionName: story.collectionName,
        stories: story.storyId,
      })
    };
  }

  async findStoriesByCurUser(userId: string) {
    const uid = new Types.ObjectId(userId);
    const stories = await this.storyRepo.find({
      ownerId: uid,
      type: 'stories',
    });
    return {
      message: 'Success',
      data: stories.map(this.STORY_RESPONSE),
    };
  }

  async findWorkingStoriesByUser(userId: string) {
    const uid = new Types.ObjectId(userId);
    const stories = await this.storyRepo.find({
      ownerId: uid,
      type: 'stories',
      isArchived: false,
    });
    return {
      message: 'Success',
      data: stories.map(this.STORY_RESPONSE)
    };
  }
  async findHighlightsByUser(userId: string) {
    const uid = new Types.ObjectId(userId);
    const hlights = await this.storyRepo.find({
      ownerId: uid,
      type: 'highlights',
    });
    return {
      message: 'Success',
      data: hlights.map(this.STORY_RESPONSE),
    };
  }

  async findStoryById(ids: string[]) {
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    const stories = await this.storyRepo.find({
      _id: { $in: objectIds },
      type: 'stories'
    });
    return {
      message: 'Success',
      data: stories.map(this.STORY_RESPONSE),
    };
  }

  async getStoryFollowing(userId: string, page: number) {
    const limit = 20;
    const skip = (page - 1) * limit;

    const currentUserStories = await this.findWorkingStoriesByUser(userId);
    const currentUserProfile = await this.userService.getPublicProfile(userId);
    const followingRelations = await this.relationServ.findByUserAndFilter(
      userId,
      'following',
    );
    if (followingRelations.length === 0) {
      return [
        {
          _id: userId,
          handleName: currentUserProfile.handleName,
          profilePic: currentUserProfile.profilePic,
          stories: currentUserStories.data.map((story) => story._id),
        },
      ];
    }

    const followingUserIds = followingRelations.map((relation) => {
      const userOneIdStr = relation.userOneID.toString();
      const userTwoIdStr = relation.userTwoID.toString();
      return userOneIdStr === userId ? userTwoIdStr : userOneIdStr;
    });

    const paginatedUserIds = followingUserIds.slice(skip, skip + limit - 1);

    const followingObjectIds = paginatedUserIds.map(
      (id) => new Types.ObjectId(id),
    );

    const stories = await this.storyRepo.find({
      ownerId: { $in: followingObjectIds },
      type: 'stories',
      isArchived: false,
    });

    const storiesByUserId = stories.reduce((acc, story) => {
      const userIdStr = story.ownerId.toString();
      if (!acc[userIdStr]) {
        acc[userIdStr] = [];
      }
      acc[userIdStr].push(story._id);
      return acc;
    }, {});

    const userProfiles = await Promise.all(
      paginatedUserIds.map(async (userId) => {
        try {
          const profile = await this.userService.getPublicProfile(userId);
          return {
            userId,
            profile,
          };
        } catch (error) {
          console.error(`Error fetching profile for user ${userId}:`, error);
          return {
            userId,
            profile: {
              handleName: '',
              profilePic: '',
            },
          };
        }
      }),
    );

    const userProfileMap = userProfiles.reduce((map, item) => {
      map[item.userId] = item.profile;
      return map;
    }, {});

    const followingStories = paginatedUserIds.map((item_id) => ({
      _id: item_id,
      handleName: userProfileMap[item_id]?.handleName || '',
      profilePic: userProfileMap[item_id]?.profilePic || '',
      stories: storiesByUserId[item_id] || [],
    }));

    if (page == 1) {
      followingStories.unshift({
        _id: userId,
        handleName: currentUserProfile.handleName,
        profilePic: currentUserProfile.profilePic,
        stories: currentUserStories.data.map((story) => story._id),
      });
    }
    return {
      message: 'Success',
      data: followingStories
    };
  }

  async createStory(uid: string, storyDto: CreateStoryDto) {
    const story = await this.storyRepo.createStory({
      ...storyDto,
      ownerId: new Types.ObjectId(uid),
      type: StoryType.STORIES,
    })
    return {
      message: 'Success',
      data: this.STORY_RESPONSE(story),
    };
  }

  async seenStory(uid: string, storyDto: UpdateStoryDto) {
    const existingStory = await this.storyRepo.findOne({ _id: storyDto._id });
    const viewerId = new Types.ObjectId(uid);
    if (!existingStory) {
      return new Error('Story not found');
    }

    const hasViewed = existingStory.viewedByUsers.some((id) =>
      id.equals(viewerId)
    );

    if (hasViewed) {
      return {
        message: 'Seen Success',
        data: this.STORY_RESPONSE(existingStory),
      };
    } else {
      [...existingStory.viewedByUsers, viewerId]
    }
    const updated = await this.storyRepo.updateStory(
      existingStory._id,
      {viewedByUsers: existingStory.viewedByUsers},
    );
    
  }

  async createHighlight(uid: string, storyDto: CreateHighlightStoryDto) {
    const res = await this.storyRepo.createStory({
      ...storyDto,
      ownerId: new Types.ObjectId(uid),
      type: StoryType.HIGHLIGHTS,
    });
    return {
      message: 'Created Success',
      data: this.STORY_RESPONSE(res)
    };
  }

  async updatedHighlight(uid: string, storyDto: UpdateHighlightDto) {
    const ref = await this.storyRepo.findOne( new Types.ObjectId(storyDto._id) );
    if (!ref) { return "Story Not found" }
    const uids = new Types.ObjectId(uid);
    if (!ref.ownerId.equals(uids)) { return "You can't update this story" }

    const { _id, ...updateData } = storyDto;
    const updated = await this.storyRepo.updateStory(ref._id, updateData)
    return {
      message: 'Success',
      data: this.STORY_RESPONSE(updated)
    }
  }
  
  async archiveStory(uid: string, storyDto: UpdateStoryDto) {
    const existingStory = await this.storyRepo.findOne({ _id: storyDto._id });
    const uids = new Types.ObjectId(uid);
    if (!existingStory.ownerId.equals(uids)) {
      return new Error ("You can't archive this story");
    }

    const res = await this.storyRepo.updateStory(
      existingStory._id,
      { isArchived: true },
    );
    return {
      message: 'Success',
      data: {
        ...this.STORY_RESPONSE(res),
        isArchived: res.isArchived,
      }
    };
  }

  async likedStory(uid: string, storyDto: UpdateStoryDto) {
    const existingStory = await this.storyRepo.findOne({ _id: storyDto._id });

    if (!existingStory) {
      return new Error('Story not found');
    }

    const uids = new Types.ObjectId(uid);
    const hasLiked = existingStory.likedByUsers.some((id) => id.equals(uids));
    const updateData: any = {
      likedByUsers: hasLiked 
        ? existingStory.likedByUsers.filter((id) => !id.equals(uids))
        : [...existingStory.likedByUsers, uids]
    };

    const res = await this.storyRepo.updateStory(existingStory._id, updateData);
    return {
      message: 'Success',
      data: this.STORY_RESPONSE(res),
    };
  }
}

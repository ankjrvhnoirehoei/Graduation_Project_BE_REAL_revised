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
import { MusicService } from 'src/music/music.service';

@Injectable()
export class StoryService {
  private readonly logger: Logger = new Logger();
  constructor(
    private readonly storyRepo: StoryRepository,
    private readonly relationServ: RelationService,
    private readonly userService: UserService,
    private readonly musicService: MusicService,
  ) {}

  // STANDARDIZE FOR STORY & RESPONSE
  private LIMIT_HIGHLIGHTS = 50;
  private LIMIT_PAGINATION = 20;
  private STORY_RESPONSE(story: Story) {
    return {
      _id: story._id,
      ownerId: story.ownerId,
      mediaUrl: story.mediaUrl,
      viewedByUsers: story.viewedByUsers,
      likedByUsers: story.likedByUsers,
      music: story.music,
      content: story.content,
      createdAt: story.createdAt,
      ...(story.type === StoryType.HIGHLIGHTS && {
        collectionName: story.collectionName,
        storyId: story.storyId,
      }),
    };
  }
  private async getMusicLink(_id: string) {
    return await this.musicService.findByID(_id.toString());
  }
  private async getStoriesMusic(stories: Story[]) {
    if (!stories || stories.length === 0) {
      return stories;
    }
    stories.map(async (sto) => {
      if (!sto.music) {
        return sto;
      }
      const res = await this.getMusicLink(sto.music._id.toString());
      return {
        ...sto,
        music: {
          _id: res._id,
          link: res.link,
          time_start: sto.music.time_start,
          time_end: sto.music.time_end,
        },
      };
    });
    return stories;
  }

  async findStoriesByCurUser(userId: string) {
    const uid = new Types.ObjectId(userId);
    let stories = await this.storyRepo.findUserStories(uid);
    if (!stories || stories.length === 0) {
      return {
        message: 'Success',
        data: [],
      };
    }
    stories = await this.getStoriesMusic(stories);
    return {
      message: 'Success',
      data: stories.map(this.STORY_RESPONSE),
    };
  }
  
  async findWorkingStoriesByUser(userId: string) {
    const uid = new Types.ObjectId(userId);
    let stories = await this.storyRepo.findUserStories(uid);
    if (!stories || stories.length === 0) {
      return {
        message: 'Success',
        data: [],
      };
    }
    stories = await this.getStoriesMusic(stories);
    return {
      message: 'Success',
      data: stories.map(this.STORY_RESPONSE),
    };
  }

  async findHighlightsByUser(userId: string) {
    const uid = new Types.ObjectId(userId);
    const hlights = await this.storyRepo.findAllUserHighlights(uid);
    return {
      message: 'Success',
      data: hlights.map(this.STORY_RESPONSE),
    };
  }

  async findStoryById(ids: string[]) {
    if (!ids || ids.length === 0) {
      return {
        message: 'Success',
        data: [],
      };
    }
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    let stories = await this.storyRepo.findStoriesByIds(objectIds);
    if (!stories || stories.length === 0) {
      return {
        message: 'Success',
        data: [],
      };
    }
    stories = await this.getStoriesMusic(stories);
    return {
      message: 'Success',
      data: stories.map(this.STORY_RESPONSE),
    };
  }

  async getStoryFollowing(userId: string, page: number) {
    const limit = 20;
    const skip = (page - 1) * limit;
    
    // Get ourself-data
    const [currentUserStories, currentUserProfile] = await Promise.all([
      this.findWorkingStoriesByUser(userId),
      this.userService.getPublicProfile(userId),
    ]);
  
    const followingRelations = await this.relationServ.findByUserAndFilter(userId, 'following');
  
    if (!followingRelations || followingRelations.length === 0) {
      return {
        message: 'Success',
        data: [
          {
            _id: userId,
            handleName: currentUserProfile.handleName,
            profilePic: currentUserProfile.profilePic,
            stories: currentUserStories.data.map((story) => story._id),
          },
        ],
      };
    }
  
    const followingUserIds = followingRelations.map((rel) =>
      rel.userOneID.toString() === userId ? rel.userTwoID.toString() : rel.userOneID.toString(),
    );
    this.logger.log(`[getStoryFollowing] followingUserIds: ${JSON.stringify(followingUserIds)}`);
  
    const paginatedUserIds = followingUserIds.slice(skip, skip + limit);
  
    const stories = await this.storyRepo.find({
      ownerId: { $in: paginatedUserIds.map((id) => new Types.ObjectId(id)) },
      type: StoryType.STORIES,
      isArchived: false,
      viewedByUsers: { $not: { $elemMatch: { $eq: new Types.ObjectId(userId) } } },
    });  
    const storiesByUserId = stories.reduce((acc, story) => {
      const id = story.ownerId.toString();
      if (!acc[id]) acc[id] = [];
      acc[id].push(story._id);
      return acc;
    }, {} as Record<string, Types.ObjectId[]>);
  
    const userIdsWithStory = paginatedUserIds.filter((id) => storiesByUserId[id]?.length > 0);
  
    if (userIdsWithStory.length === 0) {
      this.logger.log(`[getStoryFollowing] No following has story, returning only current user`);
      return {
        message: 'Success',
        data: [
          {
            _id: userId,
            handleName: currentUserProfile.handleName,
            profilePic: currentUserProfile.profilePic,
            stories: currentUserStories.data.map((story) => story._id),
          },
        ],
      };
    }
  
    const userProfiles = await Promise.all(
      userIdsWithStory.map(async (id) => {
        try {
          const profile = await this.userService.getPublicProfile(id);
          this.logger.log(`[getStoryFollowing] Got profile for userId=${id}`);
          return { userId: id, profile };
        } catch (error) {
          return { userId: id, profile: { handleName: '', profilePic: '' } };
        }
      }),
    );
  
    const userProfileMap = userProfiles.reduce((map, { userId, profile }) => {
      map[userId] = profile;
      return map;
    }, {} as Record<string, { handleName: string; profilePic: string }>);
  
    const followingStories = userIdsWithStory.map((id) => ({
      _id: id,
      handleName: userProfileMap[id]?.handleName || '',
      profilePic: userProfileMap[id]?.profilePic || '',
      stories: storiesByUserId[id] || [],
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
      data: followingStories,
    };
  }

  async createStory(uid: string, storyDto: CreateStoryDto) {
    const story = await this.storyRepo.createStory({
      ...storyDto,
      ownerId: new Types.ObjectId(uid),
      type: StoryType.STORIES,
    });
    return {
      message: 'Success',
      data: this.STORY_RESPONSE(story),
    };
  }

  async seenStory(uid: string, storyDto: UpdateStoryDto) {
    const existingStory = await this.storyRepo.findOne({ _id: storyDto._id });
    const viewerId = new Types.ObjectId(uid);

    if (!existingStory) {
      throw new Error('Story not found');
    }

    const hasViewed = (existingStory.viewedByUsers || []).some((id) =>
      id.equals(viewerId),
    );

    if (hasViewed) {
      return {
        message: 'Seen Success',
        data: this.STORY_RESPONSE(existingStory),
      };
    }
    existingStory.viewedByUsers = [...(existingStory.viewedByUsers || []),
      viewerId,
    ];
    const updated = await this.storyRepo.updateStory(existingStory._id, {
      viewedByUsers: existingStory.viewedByUsers,
    });
    return {
      message: 'Seen Success',
      data: this.STORY_RESPONSE(updated),
    };
  }
  

  async createHighlight(uid: string, storyDto: CreateHighlightStoryDto) {
    const res = await this.storyRepo.createStory({
      ...storyDto,
      ownerId: new Types.ObjectId(uid),
      type: StoryType.HIGHLIGHTS,
    });
    return {
      message: 'Created Success',
      data: this.STORY_RESPONSE(res),
    };
  }

  async updatedHighlight(uid: string, storyDto: UpdateHighlightDto) {
    const ref = await this.storyRepo.findUserHighlights(
      new Types.ObjectId(storyDto._id),
      new Types.ObjectId(uid)
    );
    if (!ref) {
      return 'Highlight Not found';
    }
    const { _id, ...updateData } = storyDto;
    const updated = await this.storyRepo.updateStory(ref._id, updateData);
    return {
      message: 'Success',
      data: this.STORY_RESPONSE(updated),
    };
  }

  async archiveStory(uid: string, storyDto: UpdateStoryDto) {
    const existingStory = await this.storyRepo.findOne({ _id: storyDto._id });
    const uids = new Types.ObjectId(uid);
    if (!existingStory.ownerId.equals(uids)) {
      return new Error("You can't archive this story");
    }

    const res = await this.storyRepo.updateStory(existingStory._id, {
      isArchived: true,
    });
    return {
      message: 'Success',
      data: {
        ...this.STORY_RESPONSE(res),
        isArchived: res.isArchived,
      },
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
        : [...existingStory.likedByUsers, uids],
    };

    const res = await this.storyRepo.updateStory(existingStory._id, updateData);
    return {
      message: 'Success',
      data: this.STORY_RESPONSE(res),
    };
  }
}

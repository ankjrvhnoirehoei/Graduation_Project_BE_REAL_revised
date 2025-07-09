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
  ) { }

  // Utilities functional
  private async getCommonUserData(uid: string) {
    const user = await this.userService.getUserById(uid);
    return {
      _id: uid,
      profilePic: user?.profilePic,
      handleName: user?.handleName,
      username: user?.username,
    };
  }
  private async enrichTagged(tag: (typeof Story.prototype.tags)[number]) {
    const userData = await this.getCommonUserData(tag.user.toString());
    return {
      user: userData._id,
      position: tag.position,
      handleName: userData.handleName,
      username: userData.username,
    };
  }
   private async enrichStoryMusic(stories: Story[]) {
    if (!stories || stories.length === 0) {
      return stories;
    }
    return await Promise.all(
      stories.map(async (sto) => {
        if (!sto.music) {
          return sto;
        }
        this.logger.log(">>>>>>>>>>>>>>>>>>", sto.music._id)
        const res = await this.musicService.findByID(sto.music._id.toString());
        return {
          ...sto,
          music: {
            _id: sto.music._id,
            link: res.link,
            time_start: sto.music.time_start,
            time_end: sto.music.time_end,
          },
        };
      }),
    );
  }
  private async enrichStoryViewers(stories: Story[]) {
    return await Promise.all(
      stories.map(async (story) => {
        if (!story.viewedByUsers || story.viewedByUsers.length === 0) {
          return story;
        }
        const updatedVied = await Promise.all(
          story.viewedByUsers.map(id => this.getCommonUserData(id.toString()))
        )
        return {
          ...story,
          viewedByUsers: updatedVied,
        };
      })
    );
  }
  private async enrichStoryTags(stories: Story[]) {
    return Promise.all(
      stories.map(async (story) => {
        const { tags, ...rest } = story;
        if (!tags || tags.length === 0) {
          return {
            ...rest,
            tags: [] as any[] // ✅ Explicit type
          };
        }
        return {
          ...rest,
          tags: await Promise.all(tags.map(tag => this.enrichTagged(tag))) as any[] // ✅ Explicit type
        };
      })
    );
  }

  // STANDARDIZE FOR STORY & RESPONSE
  private LIMIT_HIGHLIGHTS = 50;
  private LIMIT_PAGINATION = 20;
  private STORY_RESPONSE(story: any) {
    return {
      _id: story._id,
      ownerId: story.ownerId,
      mediaUrl: story.mediaUrl,
      viewedByUsers: story.viewedByUsers || [],
      likedByUsers: story.likedByUsers || [],
      music: story.music || null,
      content: story.content || null,
      tags: story.tags || [], // ✅ ADD THIS LINE
      createdAt: story.createdAt,
      ...(story.type === StoryType.HIGHLIGHTS && {
        collectionName: story.collectionName,
        thumbnail: story.thumbnail,
        storyId: story.storyId,
      }),
    };
  }
  private STORY_RESPONSE_WITH_VIEWER(story: Story, viewerId: string) {
    if (!story.viewedByUsers || story.viewedByUsers.length === 0) {
      return {
        ...this.STORY_RESPONSE(story),
        isSeen: false,
      };
    }
    const isSeen = story.viewedByUsers.some(viewer =>
      viewer._id.toString() === viewerId
    )
    return {
      ...this.STORY_RESPONSE(story),
      isSeen,
    };
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
    const [storiesWithMusic, storiesWithTags, storiesWithViewers] = await Promise.all([
      this.enrichStoryMusic(stories),
      this.enrichStoryTags(stories),
      this.enrichStoryViewers(stories)
    ]);

    stories = stories.map((story, index) => ({
      ...story,
      ...storiesWithMusic[index],
      tags: storiesWithTags[index].tags,
      viewedByUsers: storiesWithViewers[index].viewedByUsers
    })) as any as Story[];
    return {
      message: 'success',
      data: stories.map(story => this.STORY_RESPONSE_WITH_VIEWER(story, userId)),
    };
  }

  async findWorkingStoriesByUser(userId: string) {
    const uid = new Types.ObjectId(userId);
    let stories = await this.storyRepo.findUserWorkingStories(uid);
    if (!stories || stories.length === 0) {
      return {
        message: 'Success',
        data: [],
      };
    }
    const [storiesWithMusic, storiesWithTags] = await Promise.all([
      this.enrichStoryMusic(stories),
      this.enrichStoryTags(stories),
    ]);
    stories = stories.map((story, index) => ({
      ...story,
      ...storiesWithMusic[index],
      tags: storiesWithTags[index].tags,
    })) as any as Story[];

    return {
      message: 'Success',
      data: stories.map(this.STORY_RESPONSE),
    };
  }

  async findHighlightsByUser(userId: string) {
    const uid = new Types.ObjectId(userId);
    let hlights = await this.storyRepo.findAllUserHighlights(uid);
    return {
      message: 'Success',
      data: hlights.map(this.STORY_RESPONSE),
    };
  }

  async findStoryById(ids: string[], viewerId: string) {
    if (!ids || ids.length === 0) {
      return { message: 'Success', data: [] };
    }
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    let stories = await this.storyRepo.findStoriesByIds(objectIds);
    if (!stories || stories.length === 0) {
      return { message: 'Success', data: [] };
    }
    const [storiesWithMusic, storiesWithTags, storiesWithViewers] = await Promise.all([
      this.enrichStoryMusic(stories),
      this.enrichStoryTags(stories),
      this.enrichStoryViewers(stories)
    ]);
    stories = stories.map((story, index) => ({
      ...story,
      ...storiesWithMusic[index],
      tags: storiesWithTags[index].tags,
      viewedByUsers: storiesWithViewers[index].viewedByUsers
    })) as any as Story[];

    return {
      message: 'success',
      data: stories.map(story => this.STORY_RESPONSE_WITH_VIEWER(story, viewerId)),
    };
  }

  async getStoryFollowing(userId: string, page: number) {
    const limit = 20;
    const skip = (page - 1) * limit;

    const [currentUserStories, currentUserProfile] = await Promise.all([
      this.findWorkingStoriesByUser(userId),
      this.userService.getPublicProfile(userId),
    ]);

    const defaultUserList = [
      {
        _id: userId,
        username: currentUserProfile.username || '',
        handleName: currentUserProfile.handleName || '',
        profilePic: currentUserProfile.profilePic || '',
        stories: currentUserStories.data.map((story) => story._id),
      },
    ];

    const followingRelations = await this.relationServ.findByUserAndFilter(
      userId,
      'following',
    );

    const followingUserIds = followingRelations.map((rel) =>
      rel.userOneID.toString() === userId
        ? rel.userTwoID.toString()
        : rel.userOneID.toString(),
    );

    const paginatedUserIds = followingUserIds.slice(skip, skip + limit);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stories = await this.storyRepo.find({
      ownerId: { $in: paginatedUserIds.map((id) => new Types.ObjectId(id)) },
      type: StoryType.STORIES,
      isArchived: false,
      createdAt: { $gte: twentyFourHoursAgo },
    });

    const storiesByUserId = stories.reduce(
      (acc, story) => {
        const id = story.ownerId.toString();
        if (!acc[id]) acc[id] = [];
        acc[id].push(story._id);
        return acc;
      },
      {} as Record<string, Types.ObjectId[]>,
    );

    const userProfiles = await Promise.all(
      paginatedUserIds.map(async (id) => {
        try {
          const profile = await this.userService.getPublicProfile(id);
          return { userId: id, profile };
        } catch (error) {
          return { userId: id, profile: { username: '', handleName: '', profilePic: '' } };
        }
      }),
    );

    const userProfileMap = userProfiles.reduce(
      (map, { userId, profile }) => {
        map[userId] = {
          username: profile.username || '',
          handleName: profile.handleName || '',
          profilePic: profile.profilePic || '',
        };
        return map;
      },
      {} as Record<string, { username: string, handleName: string, profilePic: string }>,
    );

    const followingStories = paginatedUserIds.map((id) => ({
      _id: id,
      username: userProfileMap[id]?.username || '',
      handleName: userProfileMap[id]?.handleName || '',
      profilePic: userProfileMap[id]?.profilePic || '',
      stories: storiesByUserId[id] || [],
    }));

    return {
      message: 'Success',
      data: [...defaultUserList, ...followingStories],
    };
  }

  async createStory(uid: string, storyDto: CreateStoryDto) {
    const story = await this.storyRepo.createStory({
      ...storyDto,
      ownerId: new Types.ObjectId(uid),
      type: StoryType.STORIES,
    });
    
    // ✅ Enrich tags with user data if they exist
    let enrichedStory: any = story;
    if (story.tags && story.tags.length > 0) {
      try {
        // Manually enrich tags for newly created story
        const enrichedTags = await Promise.all(
          story.tags.map(async (tag: any) => {
            const userData = await this.getCommonUserData(tag.user.toString());
            return {
              user: userData._id,
              position: tag.position,
              handleName: userData.handleName,
              username: userData.username,
            };
          })
        );
        
        // Convert to plain object and replace tags
        const storyObj = (story as any).toObject ? (story as any).toObject() : { ...story };
        enrichedStory = { 
          ...storyObj,
          tags: enrichedTags 
        };
      } catch (error) {
        this.logger.error('Error enriching tags:', error);
        // Fallback to original story if enrichment fails
        enrichedStory = story;
      }
    }
    
    return {
      message: 'Success',
      data: this.STORY_RESPONSE(enrichedStory),
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
        message: 'Success',
        data: this.STORY_RESPONSE(existingStory),
      };
    }
    existingStory.viewedByUsers = [
      ...(existingStory.viewedByUsers || []),
      viewerId,
    ];
    const updated = await this.storyRepo.updateStory(existingStory._id, {
      viewedByUsers: existingStory.viewedByUsers,
    });
    return {
      message: 'Success',
      data: this.STORY_RESPONSE_WITH_VIEWER(updated, (viewerId).toString()),
    };
  }

  async createHighlight(uid: string, storyDto: CreateHighlightStoryDto) {
    const res = await this.storyRepo.createStory({
      ...storyDto,
      ownerId: new Types.ObjectId(uid),
      type: StoryType.HIGHLIGHTS,
    });
    return {
      message: 'Success',
      data: {
        ...this.STORY_RESPONSE(res),
      },
    };
  }

  async updatedHighlight(uid: string, storyDto: UpdateHighlightDto) {
    const ref = await this.storyRepo.findUserHighlights(
      new Types.ObjectId(storyDto._id),
      new Types.ObjectId(uid),
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

  async deletedStory(uid: string, storyDto: UpdateStoryDto) {
    const [existingStory, highlight] = await Promise.all([
      this.storyRepo.findOne({ _id: storyDto._id }),
      this.storyRepo.findAllUserHighlights(new Types.ObjectId(uid))
    ]);

    const uids = new Types.ObjectId(uid);
    if (!existingStory.ownerId.equals(uids)) {
      return new Error("You can't delete this story");
    }

    // if it type is a HIGHLIGHTS -> Delete it
    if (existingStory.type === StoryType.HIGHLIGHTS) {
      await this.storyRepo.findOneAndDelete({ _id: storyDto._id });
      return {
        message: 'Success',
      };
    }
    // if it type is a STORIES && have no HIGHLIGHTS -> Delete it
    if (!highlight || highlight.length === 0) {
      await this.storyRepo.findOneAndDelete({ _id: storyDto._id });
      return {
        message: 'Success',
      };
    }

    await Promise.all([
      highlight.map(story => {
        const hasStory = story.storyId.filter(id =>
          id.toString() !== storyDto._id
        );
        hasStory.length === 0
          ? this.storyRepo.findOneAndDelete(story._id)
          : this.storyRepo.updateStory(story._id, { storyId: hasStory })
      }),
      this.storyRepo.findOneAndDelete({ _id: storyDto._id })
    ]);

    return {
      message: 'Success',
    };
  }
}

import { Injectable } from '@nestjs/common';
import { CreateStoryDto } from './dto/create-story.dto';
import { StoryRepository } from './story.repository';
import { Types } from 'mongoose';
import { CreateHighlightStoryDto } from './dto/create-highlight.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { RelationService } from 'src/relation/relation.service';
import { UserService } from 'src/user/user.service';

@Injectable()
export class StoryService {
  constructor(
    private readonly storyRepo: StoryRepository,
    private readonly relationServ: RelationService,
    private readonly userService: UserService,
  ) { }

  async findStoriesByUser(userId: string) {
    const uid = new Types.ObjectId(userId);
    const stories = await this.storyRepo.find({
      userId: uid,
      type:'stories',
      isArchived: false
    })
    return stories.map(story => {
      return {
        _id: story._id,
        ownerId: story.ownerId,
        mediaUrl: story.mediaUrl,
        viewedByUsers: story.viewedByUsers,
        likedByUsers: story.likedByUsers,
      }
    })
  }
  async findHighlightsByUser(userId: string) {
    const uid = new Types.ObjectId(userId);
    const hlights = await this.storyRepo.find({
      userId: uid,
      type: 'highlights',
    })
    return hlights.map(story => {
      return {
        _id: story._id,
        mediaUrl: story.mediaUrl,
        collectionName: story.collectionName,
        storyId: story.storyId,
      }
    })
  }

  async findStoryById(ids: string[]) {
    const objectIds = ids.map(id => new Types.ObjectId(id));
    const stories = await this.storyRepo.find({
      _id: { $in: objectIds }
    });
    return stories.map( story => {
      return {
        _id: story._id,
        mediaUrl: story.mediaUrl,
        viewByUser: story.viewedByUsers,
        likeByUser: story.likedByUsers,
      }
    })
  };

  async getStoryFollowing(userId: string, page: number) {
    const limit = 20;
    const skip = (page - 1) * limit;

    const currentUserStories = await this.findStoriesByUser(userId);
    const currentUserProfile = await this.userService.getPublicProfile(userId);

    const followingRelations = await this.relationServ.findByUserAndFilter(userId, 'following');
    if (followingRelations.length === 0) {
        return [{
            _id: userId,
            handleName: currentUserProfile.handleName,
            profilePic: currentUserProfile.profilePic,
            stories: currentUserStories.map(story => story._id)
        }];
    }

    const followingUserIds = followingRelations.map(relation => {
        const userOneIdStr = relation.userOneID.toString();
        const userTwoIdStr = relation.userTwoID.toString();
        return userOneIdStr === userId ? userTwoIdStr : userOneIdStr;
    });

    const paginatedUserIds = followingUserIds.slice(skip, skip + limit - 1);

    const followingObjectIds = paginatedUserIds.map(id => new Types.ObjectId(id));

    const stories = await this.storyRepo.find({
        userId: { $in: followingObjectIds },
        type: 'stories',
        isArchived: false
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
                    profile
                };
            } catch (error) {
                console.error(`Error fetching profile for user ${userId}:`, error);
                return {
                    userId,
                    profile: {
                        handleName: '',
                        profilePic: ''
                    }
                };
            }
        })
    );

    const userProfileMap = userProfiles.reduce((map, item) => {
        map[item.userId] = item.profile;
        return map;
    }, {});

    const followingStories = paginatedUserIds.map(item_id => ({
        _id: item_id,
        handleName: userProfileMap[item_id]?.handleName || '',
        profilePic: userProfileMap[item_id]?.profilePic || '',
        stories: storiesByUserId[item_id] || [],
    }));

    if (currentUserStories.length > 0) {
        followingStories.unshift({
            _id: userId,
            handleName: currentUserProfile.handleName,
            profilePic: currentUserProfile.profilePic,
            stories: currentUserStories.map(story => story._id)
        });
    }
  return followingStories;
}

  async createStory(uid: string, storyDto: CreateStoryDto) {
    const story = await this.storyRepo.create({
      ...storyDto,
      ownerId: new Types.ObjectId(uid),
      type: "stories",
      isArchived: false,
      viewedByUsers: [],
      likedByUsers: [],
      collectionName: '',
      storyId: [],
    });
    return {
      message: 'Story created successfully',
      data: {
        _id: story._id,
        ownerId: story.ownerId,
        mediaUrl: story.mediaUrl,
      }
    }
  }

  async seenStory(
    uid: string,
    storyDto: UpdateStoryDto
  ) {
    const existingStory = await this.storyRepo.findOne({ _id: storyDto._id  });

    const viewerId = new Types.ObjectId(uid);

    const hasViewed = existingStory.viewedByUsers?.some(id => id.equals(viewerId));

    const updateData: any = {};

    if (!hasViewed) {
      updateData.$inc = { viewsCount: 1 };
      updateData.$push = { viewerId: viewerId };
    }

    if (Object.keys(updateData).length === 0) {
      return existingStory;
    }
    const updated = await this.storyRepo.findOneAndUpdate(
      { _id: storyDto._id },
      updateData,
    );
    return {
      message: 'Seen Success',
      data: {
        _id: updated._id,
        viewer: updated.viewedByUsers
      }
    };
  }

  async createHighlightStory(uid: string, storyDto: CreateHighlightStoryDto) {
    const res = await this.storyRepo.create({
      ...storyDto,
      ownerId: new Types.ObjectId(uid),
      type: "highlights",
      viewedByUsers: [],
      likedByUsers: [],
      isArchived: true,
      mediaUrl: '',
    });
    return {
      message: 'Created Success',
      data: {
        _id: res._id,
        collectionName: res.collectionName,
        stoies: res.storyId,
      }
    }
  }
  
  async archiveStory(uid: string, storyDto: UpdateStoryDto) {
    const existingStory = await this.storyRepo.findOne({ _id: storyDto._id  });
    const uids = new Types.ObjectId(uid);
    if (!existingStory.ownerId.equals(uids)) {
      return "You can't archive this story"
    }

    const updateData: any = {
      isArchived: true,
    };

    if (Object.keys(updateData).length === 0) {
      return existingStory;
    }
    const res = await this.storyRepo.findOneAndUpdate(
      { _id: storyDto._id },
      updateData,
    );
    return {
      message: 'Archived Success',
      data: {
        id: res._id,
      }
    }
  }

  async likedStory(uid: string, storyDto: UpdateStoryDto) {
    const existingStory = await this.storyRepo.findOne({ _id: storyDto._id  });
    const uids = new Types.ObjectId(uid);
    const hasLiked = existingStory.likedByUsers.some(id => id.equals(uids));
    const updateData: any = {};
    if (hasLiked) {
      updateData.$pull = { likes: uids };
    } else {
      updateData.$push = { likes: uids };
    }
    const res = await this.storyRepo.findOneAndUpdate(
      { _id: storyDto._id },
      updateData,
    );
    return {
      message: 'Liked Success',
      data: {
        id: res._id,
        likeByUser: res.likedByUsers
      }
    }
  }
}

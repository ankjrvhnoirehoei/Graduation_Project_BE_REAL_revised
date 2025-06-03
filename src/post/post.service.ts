import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePostDto } from './dto/post.dto';
import { Post, PostDocument } from './post.schema';
import { MediaService } from 'src/media/media.service';
import { CreateMediaDto } from 'src/media/dto/media.dto';
import { MusicService } from 'src/music/music.service';
import { MusicDto } from 'src/music/dto/music.dto';
import { Music } from 'src/music/music.schema';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private readonly mediaService: MediaService,
    private readonly musicService: MusicService,
  ) {}

  async create(postDto: CreatePostDto): Promise<Post> {
    const createdPost = new this.postModel({
      ...postDto,
      userID: new Types.ObjectId(postDto.userID),
    });
    return createdPost.save();
  }

  async createPostWithMediaAndMusic(postWithMediaDto: {
    post: CreatePostDto;
    media: CreateMediaDto[];
    music?: MusicDto;
  }): Promise<{ post: Post; media: any[]; music?: Music }> {
    const userId = postWithMediaDto.post.userID;
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId from token');
    }

    let musicCreated: Music | null = null;
    if (postWithMediaDto.music) {
      musicCreated = await this.musicService.create(postWithMediaDto.music);
    }

    const postData: any = {
      ...postWithMediaDto.post,
      userID: new Types.ObjectId(userId),
      musicID: musicCreated ? musicCreated._id : undefined,
      viewCount: postWithMediaDto.post.viewCount ?? 0,
      isEnable: postWithMediaDto.post.isEnable ?? true,
    };

    const createdPost: any = await this.create(postData);
    const postId = createdPost._id;

    const mediaCreated = await Promise.all(
      postWithMediaDto.media.map((media) =>
        this.mediaService.create({ ...media, postID: postId }),
      ),
    );

    return {
      post: createdPost,
      media: mediaCreated,
      music: musicCreated ?? undefined,
    };
  }

  async getPostType(postId: string): Promise<'post' | 'reel' | 'music'> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID format');
    }

    const post = await this.postModel.findById(postId).select('type').lean();
    if (!post) {
      throw new BadRequestException('Post not found');
    }

    return post.type as 'post' | 'reel' | 'music';
  }

  async findAllWithMedia(userId: string): Promise<any[]> {
    const currentUserObjectId = new Types.ObjectId(userId);

    return this.postModel.aggregate([
      {
        $match: {
          type: { $in: ['reel', 'post'] },
          isEnable: true,
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
      { $sample: { size: 20 } },

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
        $addFields: {
          likeCount: { $size: '$likes' },
        },
      },
      {
        $lookup: {
          from: 'postlikes',
          let: { postId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$postId', '$$postId'] },
                    { $eq: ['$userId', currentUserObjectId] },
                  ],
                },
              },
            },
          ],
          as: 'userLikeEntry',
        },
      },
      {
        $addFields: {
          isLike: { $gt: [{ $size: '$userLikeEntry' }, 0] },
        },
      },
      {
        $lookup: {
          from: 'music',
          localField: 'musicID',
          foreignField: '_id',
          as: 'music',
        },
      },
      {
        $lookup: {
          from: 'comments',
          localField: '_id',
          foreignField: 'postID',
          as: 'comments',
        },
      },
      { $unwind: { path: '$music', preserveNullAndEmptyArrays: true } },
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
          isLike: 1,
          music: 1,
          'user._id': 1,
          'user.handleName': 1,
          'user.profilePic': 1,
        },
      },
    ]);
  }

  async findReelsWithMedia(userId: string): Promise<any[]> {
    const currentUserObjectId = new Types.ObjectId(userId);

    return this.postModel.aggregate([
      {
        $match: {
          type: 'reel',
          isEnable: true,
          nsfw: false,
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
      { $sample: { size: 20 } },
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
          localField: '_id',
          foreignField: 'postID',
          as: 'comments',
        },
      },
      {
        $addFields: {
          likeCount: { $size: '$likes' },
        },
      },
      {
        $lookup: {
          from: 'postlikes',
          let: { postId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$postId', '$$postId'] },
                    { $eq: ['$userId', currentUserObjectId] },
                  ],
                },
              },
            },
          ],
          as: 'userLikeEntry',
        },
      },
      {
        $addFields: {
          isLike: { $gt: [{ $size: '$userLikeEntry' }, 0] },
        },
      },
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
          'user._id': 1,
          'user.handleName': 1,
          'user.profilePic': 1,
        },
      },
    ]);
  }

  // returns up to 50 'post'‐type documents for the given user, plus a total count
  async getUserPostsWithMedia(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ total: number; items: any[] }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }
    const objectUserId = new Types.ObjectId(userId);
    const skip = (page - 1) * limit;

    // count total number of 'post'-type documents for this user
    const total = await this.postModel.countDocuments({
      userID: objectUserId,
      type: 'post',
    });

    // fetch paginated results with lookups
    const items = await this.postModel
      .aggregate([
        {
          $match: {
            userID: objectUserId,
            type: 'post',
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },

        // lookup media documents attached to each post
        {
          $lookup: {
            from: 'media',
            localField: '_id',
            foreignField: 'postID',
            as: 'media',
          },
        },

        // lookup likes just to compute likeCount
        {
          $lookup: {
            from: 'postlikes',
            localField: '_id',
            foreignField: 'postId',
            as: 'likes',
          },
        },
        {
          $addFields: {
            likeCount: { $size: '$likes' },
          },
        },

        // lookup music if any
        {
          $lookup: {
            from: 'music',
            localField: 'musicID',
            foreignField: '_id',
            as: 'music',
          },
        },
        {
          $unwind: {
            path: '$music',
            preserveNullAndEmptyArrays: true,
          },
        },

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
            music: 1,
          },
        },
      ])
      .exec();

    return { total, items };
  }

  // returns up to 50 'reel'‐type documents for the given user, plus a total count.
  async getUserReelsWithMedia(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ total: number; items: any[] }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }
    const objectUserId = new Types.ObjectId(userId);
    const skip = (page - 1) * limit;

    const total = await this.postModel.countDocuments({
      userID: objectUserId,
      type: 'reel',
    });

    const items = await this.postModel
      .aggregate([
        {
          $match: {
            userID: objectUserId,
            type: 'reel',
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },

        // lookup media
        {
          $lookup: {
            from: 'media',
            localField: '_id',
            foreignField: 'postID',
            as: 'media',
          },
        },

        // lookup likes to compute likeCount
        {
          $lookup: {
            from: 'postlikes',
            localField: '_id',
            foreignField: 'postId',
            as: 'likes',
          },
        },
        {
          $addFields: {
            likeCount: { $size: '$likes' },
          },
        },

        // no need to lookup user here—front‐end knows whose reels these are

        // lookup music if any
        {
          $lookup: {
            from: 'music',
            localField: 'musicID',
            foreignField: '_id',
            as: 'music',
          },
        },
        {
          $unwind: {
            path: '$music',
            preserveNullAndEmptyArrays: true,
          },
        },

        // project fields
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
            music: 1,
          },
        },
      ])
      .exec();

    return { total, items };
  }
}

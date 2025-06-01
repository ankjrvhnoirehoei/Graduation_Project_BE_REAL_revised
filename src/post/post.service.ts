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

  return { post: createdPost, media: mediaCreated, music: musicCreated ?? undefined };
}

  async findAllWithMedia(): Promise<any[]> {
    return this.postModel.aggregate([
      {
        $match: {
          type: { $in: ['reel', 'post'] },
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
          from: 'video_likes',
          localField: '_id',
          foreignField: 'videoId',
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
          from: 'music',
          localField: 'musicID',
          foreignField: '_id',
          as: 'music',
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
          music: 1,
          'user._id': 1,
          'user.handleName': 1,
          'user.profilePic': 1,
        },
      },
    ]);
  }

  async findReelsWithMedia(): Promise<any[]> {
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
          from: 'video_likes',
          localField: '_id',
          foreignField: 'videoId',
          as: 'likes',
        },
      },
      {
        $addFields: {
          likeCount: { $size: '$likes' },
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
          'user._id': 1,
          'user.handleName': 1,
          'user.profilePic': 1,
        },
      },
    ]);
  }
}

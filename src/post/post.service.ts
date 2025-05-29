import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePostDto } from './dto/post.dto';
import { Post, PostDocument } from './post.schema';
import { MediaService } from 'src/media/media.service';
import { CreateMediaDto } from 'src/media/dto/media.dto';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private readonly mediaService: MediaService,
  ) {}

  async create(postDto: CreatePostDto): Promise<Post> {
    const createdPost = new this.postModel({
      ...postDto,
      userID: new Types.ObjectId(postDto.userID),
    });
    return createdPost.save();
  }

  async createPostWithMedia(postWithMediaDto: {
    post: CreatePostDto;
    media: CreateMediaDto[];
  }): Promise<{ post: Post; media: any[] }> {
    const createdPost: any = await this.create(postWithMediaDto.post);
    const postId = createdPost._id;

    const mediaCreated = await Promise.all(
      postWithMediaDto.media.map((media) =>
        this.mediaService.create({ ...media, postID: postId }),
      ),
    );

    return { post: createdPost, media: mediaCreated };
  }

  async findAllWithMedia(userId: string): Promise<any[]> {
    return this.postModel.aggregate([
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
          isLiked: {
            $in: [new Types.ObjectId(userId), '$likes.userId'],
          },
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
          isLiked: 1,
          'user._id': 1,
          'user.handleName': 1,
          'user.profilePic': 1,
        },
      },
    ]);
  }

  async findReelsWithMedia(userId: string): Promise<any[]> {
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
          isLiked: {
            $in: [new Types.ObjectId(userId), '$likes.userId'],
          },
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
          isLiked: 1,
          'user._id': 1,
          'user.handleName': 1,
          'user.profilePic': 1,
        },
      },
    ]);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreatePostDto } from './dto/create-post.dto';
import { Post, PostDocument } from './post.schema';
import { MediaService } from 'src/media/media.service';
import { CreateMediaDto } from 'src/media/dto/create-media.dto';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private readonly mediaService: MediaService,
  ) {}

  async create(postDto: CreatePostDto): Promise<Post> {
    const createdPost = new this.postModel(postDto);
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

  //   async findAll(): Promise<Post[]> {
  //     return this.postModel.find().exec();
  //   }

  async findAllWithMedia(): Promise<any[]> {
    return this.postModel.aggregate([
      {
        $lookup: {
          from: 'media',
          localField: '_id',
          foreignField: 'postID',
          as: 'media',
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ]);
  }
}

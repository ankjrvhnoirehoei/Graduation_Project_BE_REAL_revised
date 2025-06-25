import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MusicDto } from './dto/music.dto';
import { Music } from './music.schema';

@Injectable()
export class MusicService {
  constructor(
    @InjectModel(Music.name) private readonly musicModel: Model<Music>,
  ) {}

  async create(musicDto: MusicDto): Promise<Music> {
    const created = new this.musicModel(musicDto);
    return created.save();
  }

  async findByPost(postID: string): Promise<Music[]> {
    return this.musicModel.find({ postID }).exec();
  }

  async findByID(id: string): Promise<Music> {
    const music = await this.musicModel.findById(id).lean();
    if (!music) { 
      throw new Error('Music not found');
    }
    return music;
  }

  async findAll(userId: string): Promise<
    (Music & { isBookmarked: boolean })[]
  > {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    const uid = new Types.ObjectId(userId);

    return this.musicModel
      .aggregate([
        // 1) look up the user's “Music” playlist
        {
          $lookup: {
            from: 'bookmarkplaylists',
            let: { userId: uid },
            pipeline: [
              { $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$userID', '$$userId'] },
                      { $eq: ['$playlistName', 'Music'] },
                      { $eq: ['$isDeleted', false] },
                    ]
                  }
                }
              },
              { $limit: 1 }
            ],
            as: 'playlist'
          }
        },
        { $unwind: { path: '$playlist', preserveNullAndEmptyArrays: true } },

        // 2) for each music doc, look for a matching non-deleted bookmark-item
        {
          $lookup: {
            from: 'bookmarkitems',
            let: { 
              musicId: '$_id',
              playlistId: '$playlist._id'
            },
            pipeline: [
              { $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$itemID', '$$musicId'] },
                      { $eq: ['$playlistID', '$$playlistId'] },
                      { $eq: ['$itemType', 'music'] },
                      { $eq: ['$isDeleted', false] },
                    ]
                  }
                }
              },
              { $limit: 1 }
            ],
            as: 'bookmarkLookup'
          }
        },

        // 3) add the flag
        {
          $addFields: {
            isBookmarked: {
              $gt: [ { $size: '$bookmarkLookup' }, 0 ]
            }
          }
        },

        // 4) drop the intermediate arrays
        {
          $project: {
            bookmarkLookup: 0,
            playlist:       0,
            __v:            0
          }
        }
      ])
      .exec();
  }
}
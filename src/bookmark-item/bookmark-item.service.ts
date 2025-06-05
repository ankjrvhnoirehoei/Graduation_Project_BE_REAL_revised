import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookmarkItem, BookmarkItemDocument } from './bookmark-item.schema';
import {
  BookmarkPlaylist,
  BookmarkPlaylistDocument,
} from 'src/bookmark-playlist/bookmark-playlist.schema';
import { PostService } from 'src/post/post.service';

@Injectable()
export class BookmarkItemService {
  constructor(
    @InjectModel(BookmarkItem.name)
    private readonly itemModel: Model<BookmarkItemDocument>,
    @InjectModel(BookmarkPlaylist.name)
    private readonly playlistModel: Model<BookmarkPlaylistDocument>,
    private readonly postService: PostService,
  ) {}

  // returns all non-deleted items in a given playlist
  async findAllByPlaylist(
    playlistId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ items: BookmarkItem[]; total: number }> {
    if (!Types.ObjectId.isValid(playlistId)) {
      throw new BadRequestException('Invalid playlist ID format.');
    }

    const skip = (page - 1) * limit;
    const playlistObjectId = new Types.ObjectId(playlistId);

    // Get total count
    const total = await this.itemModel.countDocuments({
      playlistID: playlistObjectId,
      isDeleted: false,
    });

    // Get paginated items
    const items = await this.itemModel
      .find({
        playlistID: playlistObjectId,
        isDeleted: false,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return { items, total };
  }
  // validate that a playlist belongs to the given user, used to create or delete
  async validatePlaylistOwnership(
    playlistId: string,
    userId: string,
  ): Promise<BookmarkPlaylist> {
    if (!Types.ObjectId.isValid(playlistId)) {
      throw new BadRequestException('Invalid playlist ID format.');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }

    const playlist = await this.playlistModel.findOne({
      _id: new Types.ObjectId(playlistId),
      userID: new Types.ObjectId(userId),
      isDeleted: false,
    });

    // console.log('_id: ', playlistId, '\nuserID: ', userId);

    if (!playlist) {
      throw new BadRequestException(
        'Playlist not found or does not belong to user.',
      );
    }

    return playlist;
  }

  // create a new bookmark item, ensuring no duplicates (partial filter)
  async create(
    playlistId: string,
    itemId: string,
    userId: string,
  ): Promise<BookmarkItem> {
  // ensure playlist belongs to user
    await this.validatePlaylistOwnership(playlistId, userId);

    if (!Types.ObjectId.isValid(itemId)) {
      throw new BadRequestException('Invalid item ID format.');
    }

    // Get the post type using PostService
    const itemType = await this.postService.getPostType(itemId);

    const newItem = new this.itemModel({
      playlistID: new Types.ObjectId(playlistId),
      itemID: new Types.ObjectId(itemId),
      itemType,
      isDeleted: false,
    });

    return newItem.save();
  }

  /**
   * soft-delete multiple bookmark items from a single playlist
   * returns the number of documents actually modified 
   */
  async removeMultiple(
    playlistId: string,
    postIds: string[],
    userId: string,
  ): Promise<number> {
    // validate playlist ownership
    await this.validatePlaylistOwnership(playlistId, userId);

    // validate each postId
    const objectPostIds: Types.ObjectId[] = [];
    for (const pid of postIds) {
      if (!Types.ObjectId.isValid(pid)) {
        throw new BadRequestException(`Invalid post ID format: ${pid}`);
      }
      objectPostIds.push(new Types.ObjectId(pid));
    }

    // perform a bulk update: set isDeleted = true where:
    // playlistID matches, itemID in provided list, and isDeleted = false
    const result = await this.itemModel.updateMany(
      {
        playlistID: new Types.ObjectId(playlistId),
        itemID: { $in: objectPostIds },
        isDeleted: false,
      },
      { isDeleted: true },
    );

    const modifiedCount =
      (result as any).modifiedCount ?? (result as any).nModified ?? 0;

    return modifiedCount;
  }
}

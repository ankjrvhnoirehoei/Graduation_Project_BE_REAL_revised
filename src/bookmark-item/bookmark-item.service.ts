import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { BookmarkItem, BookmarkItemDocument } from './bookmark-item.schema';
import {
  BookmarkPlaylist,
  BookmarkPlaylistDocument,
} from 'src/bookmark-playlist/bookmark-playlist.schema';
import { PostService } from 'src/post/post.service';
import { MusicService } from 'src/music/music.service';
import { BookmarkPlaylistService } from 'src/bookmark-playlist/bookmark-playlist.service';
import { CommonServices } from 'src/admin/helpers/helpers.service';
interface RemovalResult {
  deletedCount: number;
  notFoundCount: number;
  details: Array<{
    postId: string;
    status: 'deleted' | 'not_found';
    playlistId?: string;
  }>;
}

@Injectable()
export class BookmarkItemService {
  constructor(
    @InjectModel(BookmarkItem.name)
    private readonly itemModel: Model<BookmarkItemDocument>,
    @InjectModel(BookmarkPlaylist.name)
    private readonly playlistModel: Model<BookmarkPlaylistDocument>,
    private readonly postService: PostService,
    private readonly musicService: MusicService, 
    @Inject(forwardRef(() => BookmarkPlaylistService))
    private readonly playlistService: BookmarkPlaylistService,
    private readonly commonService: CommonServices,
  ) {}

  // returns all non-deleted items in a given playlist
  async findAllByPlaylist(
    playlistId: string,
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    items: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      limit: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    // fetch + validate playlist
    const playlist = await this.playlistService.findByIdAndUser(
      playlistId,
      userId,
    );

    // find all non‑deleted bookmark entries for this playlist
    const allEntries = await this.itemModel
      .find(
        { playlistID: playlist._id, isDeleted: false },
        { itemID: 1 },          // project only the itemID
      )
      .sort({ createdAt: -1 })  // bookmark order
      .exec();

    const allIds = allEntries.map((e) => e.itemID);
    const total = allEntries.length;

    // if this is the “Âm nhạc” playlist, return music items
    if (playlist.playlistName === 'Âm nhạc') {
      const start = (page - 1) * limit;
      const slice = allIds.slice(start, start + limit);

      const data = await this.musicService.findManyByIds(slice);
      // assume findManyByIds returns the same enriched shape for musics

      const totalPages = Math.max(Math.ceil(total / limit), 1);
      return {
        items: data,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount: total,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    }

    const result = await this.commonService.runPagedAggregation(
      {
        _userId: userId,
        type: { $in: ['post', 'reel'] },
        _id: { $in: allIds },
      },
      page,
      limit,
    );

    return result;
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

    const pid = new Types.ObjectId(playlistId);
    const iid = new Types.ObjectId(itemId);

    // Get the post type using PostService
    const itemType = await this.postService.getPostType(itemId);

    // Check for existing soft-deleted item
    const existing = await this.itemModel.findOne({
      playlistID: pid,
      itemID: iid,
      itemType,
    });

    if (existing) {
      if (!existing.isDeleted) {
        throw new BadRequestException('This item is already bookmarked.');
      }
      // Resurrect the soft-deleted item
      existing.isDeleted = false;
      return existing.save();
    }

    // Create new if no existing item found
    const newItem = new this.itemModel({
      playlistID: pid,
      itemID: iid,
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

  // add or read a music item to a playlist
  async createMusic(
    playlistId: string,
    musicId: string,
    userId: string,
  ): Promise<BookmarkItem> {
    await this.validatePlaylistOwnership(playlistId, userId);

    if (!Types.ObjectId.isValid(musicId)) {
      throw new BadRequestException('Invalid music ID format.');
    }
    const pid = new Types.ObjectId(playlistId);
    const mid = new Types.ObjectId(musicId);

    // see if there's a soft-deleted one we can resurrect
    const existing = await this.itemModel.findOne({
      playlistID: pid,
      itemID: mid,
      itemType: 'music',
    });

    if (existing) {
      if (!existing.isDeleted) {
        throw new BadRequestException('This music is already bookmarked.');
      }
      existing.isDeleted = false;
      return existing.save();
    }

    // otherwise create fresh
    const bookmark = new this.itemModel({
      playlistID: pid,
      itemID: mid,
      itemType: 'music',
      isDeleted: false,
    });
    return bookmark.save();
  }

  // soft-delete a music item from a playlist
  async removeMusic(
    playlistId: string,
    musicId: string,
    userId: string,
  ): Promise<number> {
    await this.validatePlaylistOwnership(playlistId, userId);

    if (!Types.ObjectId.isValid(musicId)) {
      throw new BadRequestException('Invalid music ID format.');
    }
    const pid = new Types.ObjectId(playlistId);
    const mid = new Types.ObjectId(musicId);

    const result = await this.itemModel.updateOne(
      { playlistID: pid, itemID: mid, itemType: 'music', isDeleted: false },
      { isDeleted: true },
    );

    // modifiedCount is 1 if flipped
    const count = (result as any).modifiedCount ?? 0;
    if (count === 0) {
      throw new BadRequestException('No active bookmark found to remove.');
    }
    return count;
  }  

  // for checking if a post or reel is already in a bookmark playlist of the user
  async exists(
    playlistId: string,
    itemId: string,
  ): Promise<boolean> {
    const pid = new Types.ObjectId(playlistId);
    const iid = new Types.ObjectId(itemId);
    const count = await this.itemModel.countDocuments({
      playlistID: pid,
      itemID: iid,
      isDeleted: false,
    });
    return count > 0;
  }

  async markItemsDeletedByPlaylist(playlistId: string): Promise<number> {
    if (!Types.ObjectId.isValid(playlistId)) {
      throw new BadRequestException('Invalid playlist ID format.');
    }
    const result = await this.itemModel.updateMany(
      { playlistID: new Types.ObjectId(playlistId), isDeleted: false },
      { $set: { isDeleted: true } },
    );
    return result.modifiedCount;
  }

  /** 
   * Remove a single post from whichever playlist it's in for this user. 
   * Then decrement that playlist's postCount by 1.
   */
  async removeByUserAndPosts(userId: string, postIds: string[]): Promise<RemovalResult> {
    // Find all playlists for this user
    const playlists = await this.playlistModel
      .find({ userID: new Types.ObjectId(userId), isDeleted: false })
      .select('_id')
      .exec();
    const pids = playlists.map(p => p._id);

    if (pids.length === 0) {
      throw new BadRequestException('No active playlists found for this user.');
    }

    // Convert postIds to ObjectIds
    const postObjectIds = postIds.map(id => new Types.ObjectId(id));

    // Find all existing bookmarks that match the criteria
    const existingBookmarks = await this.itemModel.find({
      itemID: { $in: postObjectIds },
      playlistID: { $in: pids },
      isDeleted: false,
    }).exec();

    if (existingBookmarks.length === 0) {
      return {
        deletedCount: 0,
        notFoundCount: postIds.length,
        details: postIds.map(postId => ({
          postId,
          status: 'not_found' as const,
        }))
      };
    }

    // Soft delete all found bookmarks
    const bookmarkIds = existingBookmarks.map(bookmark => bookmark._id);
    await this.itemModel.updateMany(
      { _id: { $in: bookmarkIds } },
      { $set: { isDeleted: true } }
    );

    // Count deletions per playlist to update postCount
    const playlistDeletionCounts = new Map<string, number>();
    existingBookmarks.forEach(bookmark => {
      const playlistIdStr = bookmark.playlistID.toString();
      playlistDeletionCounts.set(
        playlistIdStr, 
        (playlistDeletionCounts.get(playlistIdStr) || 0) + 1
      );
    });

    // Update postCount for affected playlists
    const updatePromises = Array.from(playlistDeletionCounts.entries()).map(
      ([playlistId, count]) => 
        this.playlistModel.updateOne(
          { _id: new Types.ObjectId(playlistId) },
          { $inc: { postCount: -count } }
        )
    );
    await Promise.all(updatePromises);

    // Create result details
    const deletedPostIds = new Set(
      existingBookmarks.map(bookmark => bookmark.itemID.toString())
    );

    const details = postIds.map(postId => {
      const wasDeleted = deletedPostIds.has(postId);
      const bookmark = existingBookmarks.find(b => b.itemID.toString() === postId);
      
      return {
        postId,
        status: wasDeleted ? 'deleted' as const : 'not_found' as const,
        ...(wasDeleted && bookmark && { playlistId: bookmark.playlistID.toString() })
      };
    });

    return {
      deletedCount: existingBookmarks.length,
      notFoundCount: postIds.length - existingBookmarks.length,
      details
    };
  }

  async findAllByUser(
    userId: string,
    page = 1,
    limit = 20,
  ) {
    const uid = new Types.ObjectId(userId);

    const raw = await this.itemModel
      .find({ playlistID: { $in: await this.getPlaylistIds(uid) }, isDeleted: false })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('itemID createdAt playlistID')
      .lean({ getters: true, virtuals: false });

    const total  = await this.itemModel.countDocuments({ playlistID: { $in: await this.getPlaylistIds(uid) }, isDeleted: false });
    const ids    = raw.map((r) => r.itemID);

    const { items, pagination } = await this.commonService.runPagedAggregation(
      { _userId: userId, _id: { $in: ids }, type: { $in: ['post','reel'] } },
      page,
      limit
    );

    const byId = new Map(raw.map(r => [String(r.itemID), r]));
    const data = items.map(i => ({
      ...i,
      bookmark: {
        playlistID: byId.get(String(i._id))!.playlistID,
        createdAtBookmark: byId.get(String(i._id))!.createdAt,
      }
    }));

    return { data, total, pagination };
  }

  // helper to fetch all playlist IDs
  private async getPlaylistIds(uid: Types.ObjectId) {
    const pls = await this.playlistModel
      .find({ userID: uid, isDeleted: false })
      .select('_id')
      .lean();
    return pls.map(p => p._id);
  }
}

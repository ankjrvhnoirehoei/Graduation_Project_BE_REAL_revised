import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BookmarkPlaylist,
  BookmarkPlaylistDocument,
} from './bookmark-playlist.schema';
import { Document } from 'mongoose';
import { BookmarkItemService } from 'src/bookmark-item/bookmark-item.service';

@Injectable()
export class BookmarkPlaylistService {
  constructor(
    @InjectModel(BookmarkPlaylist.name)
    private readonly playlistModel: Model<BookmarkPlaylistDocument>,
    private readonly bookmarkItemService: BookmarkItemService,
  ) {}

  /**
   * returns all non-deleted playlists for a given user
   * if none exist, automatically creates the two default playlists
   * ("All posts" and "Music") and returns them.
   */
  async findAllByUser(userId: string): Promise<BookmarkPlaylist[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    const objectUserId = new Types.ObjectId(userId);

    const existing = await this.playlistModel
      .find({ userID: objectUserId, isDeleted: false })
      .sort({ createdAt: 1 })
      .exec();

    if (existing.length > 0) {
      return existing;
    }

    // no playlists exist yet: create the two defaults
    const defaults = [
      {
        userID: objectUserId,
        playlistName: 'All posts',
        postCount: 0,
        isDeleted: false,
      },
      {
        userID: objectUserId,
        playlistName: 'Music',
        postCount: 0,
        isDeleted: false,
      },
    ];

    const created = await this.playlistModel.insertMany(defaults);
    return created;
  }

  // find a single playlist by ID, ensure it belongs to user, and is not deleted.
  async findByIdAndUser(
    playlistId: string,
    userId: string,
  ): Promise<BookmarkPlaylistDocument> {
    if (!Types.ObjectId.isValid(playlistId)) {
      throw new BadRequestException('Invalid playlist ID format.');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }

    const playlist = await this.playlistModel
      .findOne({
        _id: new Types.ObjectId(playlistId),
        userID: new Types.ObjectId(userId),
        isDeleted: false,
      })
      .exec();

    if (!playlist) {
      throw new BadRequestException(
        'Playlist not found or does not belong to the user.',
      );
    }

    return playlist;
  }

  /**
   * creates a new playlist for `userId` with the given `playlistName
   * - ensures the user has fewer than 10 non-deleted playlists
   * - ensures no other non-deleted playlist of the same name for this user
   */
  async createPlaylist(
    userId: string,
    playlistName: string,
  ): Promise<BookmarkPlaylist> {
    if (!playlistName || typeof playlistName !== 'string') {
      throw new BadRequestException('playlistName is required and must be a string.');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    const objectUserId = new Types.ObjectId(userId);

    // count existing non-deleted playlists for this user
    const count = await this.playlistModel.countDocuments({
      userID: objectUserId,
      isDeleted: false,
    });
    if (count >= 10) {
      throw new BadRequestException('Cannot have more than 10 active playlists.');
    }

    // check if a same-named (case-sensitive) playlist already exists
    const existing = await this.playlistModel.findOne({
      userID: objectUserId,
      playlistName: playlistName,
      isDeleted: false,
    });
    if (existing) {
      throw new BadRequestException('You already have a playlist with that exact name.');
    }

    // create and return
    const created = new this.playlistModel({
      userID: objectUserId,
      playlistName,
      postCount: 0,
      isDeleted: false,
    });
    return created.save();
  }

  /**
   * renames (and/or updates coverImg of) an existing playlist.
   * - Ensures the playlist belongs to the user and is not deleted.
   * - Ensures the new name is not exactly the same as another non-deleted playlist.
   */
  async renamePlaylist(
    playlistId: string,
    userId: string,
    newName: string,
    coverImg?: string,
  ): Promise<BookmarkPlaylistDocument> {
    if (!Types.ObjectId.isValid(playlistId)) {
      throw new BadRequestException('Invalid playlist ID format.');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    if (!newName || typeof newName !== 'string') {
      throw new BadRequestException('new playlistName is required and must be a string.');
    }

    // fetch and validate ownership
    const playlist = await this.findByIdAndUser(playlistId, userId);

    // check for duplicates (other than this playlist)
    const duplicate = await this.playlistModel.findOne({
      userID: new Types.ObjectId(userId),
      playlistName: newName,
      isDeleted: false,
      _id: { $ne: (playlist as Document)._id }, 
    });
    if (duplicate) {
      throw new BadRequestException('You already have a playlist with that exact name.');
    }

    // update fields
    playlist.playlistName = newName;
    if (coverImg !== undefined) {
      playlist.coverImg = coverImg;
    }
    return playlist.save();
  }

  /**
   * adjusts (increments or decrements) the `postCount` of a playlist by `delta`
   * validates that the playlist belongs to `userId` and is not deleted
   */
  async adjustPostCount(
    playlistId: string,
    userId: string,
    delta: number,
  ): Promise<void> {
    // validate ownership (throws if invalid)
    await this.findByIdAndUser(playlistId, userId);

    // atomically increment/decrement
    await this.playlistModel.updateOne(
      { _id: new Types.ObjectId(playlistId) },
      { $inc: { postCount: delta } },
    );
  }
}

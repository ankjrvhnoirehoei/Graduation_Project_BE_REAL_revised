import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BookmarkPlaylist,
  BookmarkPlaylistDocument,
} from './bookmark-playlist.schema';
import { Document } from 'mongoose';
import { BookmarkItemService } from 'src/bookmark-item/bookmark-item.service';
import { BookmarkItem, BookmarkItemDocument } from 'src/bookmark-item/bookmark-item.schema';
import { Media, MediaDocument } from 'src/media/media.schema';
import { Music, MusicDocument } from 'src/music/music.schema';

@Injectable()
export class BookmarkPlaylistService {
  constructor(
    @InjectModel(BookmarkPlaylist.name)
    private readonly playlistModel: Model<BookmarkPlaylistDocument>,
    private readonly bookmarkItemService: BookmarkItemService,
    @InjectModel(BookmarkItem.name) 
    private readonly bookmarkItemModel: Model<BookmarkItemDocument>,
    @InjectModel(Media.name)
    private readonly mediaModel: Model<MediaDocument>,
    @InjectModel(Music.name)
    private readonly musicModel: Model<MusicDocument>,
  ) {}

  /**
   * returns all non-deleted playlists for a given user
   * if none exist, automatically creates the two default playlists
   * ("All posts" and "Music") and returns them.
   */
  async findAllByUser(userId: string): Promise<(BookmarkPlaylist & { thumbnails: string[] })[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    const uid = new Types.ObjectId(userId);

    // 1) load existing playlists
    let playlists = await this.playlistModel
      .find({ userID: uid, isDeleted: false })
      .sort({ createdAt: 1 })
      .exec();

    // 2) if none exist, insert defaults and reload
    if (playlists.length === 0) {
      const defaults = [
        { userID: uid, playlistName: 'All posts' },
        { userID: uid, playlistName: 'Music' },
      ];
      await this.playlistModel.insertMany(defaults);
      playlists = await this.playlistModel
        .find({ userID: uid, isDeleted: false })
        .sort({ createdAt: 1 })
        .exec();
    }

    // 3) enrich each with thumbnails
    return this.addThumbnails(playlists);
  }

  /**
   * For each playlist: grab its newest 4 bookmark‐items,
   * fetch up to 4 media URLs for post/reel items and coverImgs for music items,
   * merge, slice to 4, pad with "".
   */
  private async addThumbnails(
    playlists: BookmarkPlaylistDocument[],
  ): Promise<(BookmarkPlaylist & { thumbnails: string[] })[]> {
    return Promise.all(
      playlists.map(async (pl) => {
        // a) load newest 4 items
        const items = await this.bookmarkItemModel
          .find({ playlistID: pl._id, isDeleted: false })
          .sort({ createdAt: -1 })
          .limit(4)
          .exec();

        // b) split types
        const postIds: Types.ObjectId[] = [];
        const musicIds: Types.ObjectId[] = [];
        for (const it of items) {
          if (it.itemType === 'music') {
            musicIds.push(it.itemID);
          } else {
            postIds.push(it.itemID);
          }
        }

        // c) fetch up to 4 medias for all post/reel IDs
        const mediaDocs = await this.mediaModel
          .find({ postID: { $in: postIds } })
          .limit(4)
          .exec();

        const mediaUrls = mediaDocs.map((m) => m.videoUrl ?? m.imageUrl);

        // d) fetch coverImg for each music ID
        const musicDocs = await this.musicModel
          .find({ _id: { $in: musicIds } })
          .select('coverImg')
          .exec();

        const musicUrls = musicDocs.map((m) => m.coverImg);

        // e) combine, slice/pad to exactly 4 entries
        const combined = [...mediaUrls, ...musicUrls].slice(0, 4);
        while (combined.length < 4) combined.push('');

        // f) return playlist plus thumbnails
        return {
          ...pl.toObject(),
          thumbnails: combined,
        };
      }),
    );
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

  private async findMusicPlaylist(userId: string): Promise<BookmarkPlaylistDocument> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    const pid = new Types.ObjectId(userId);
    const pl = await this.playlistModel.findOne({
      userID: pid,
      playlistName: 'Music',
      isDeleted: false,
    });
    if (!pl) {
      throw new BadRequestException('Music playlist not found for this user.');
    }
    return pl;
  }

  // add music to playlist
  async addMusicToPlaylist(userId: string, musicId: string) {
    const playlist = await this.findMusicPlaylist(userId);
    if (playlist.playlistName != 'Music') {
      throw new BadRequestException(`Can't add music to non-music playlists.`)
    }
    const bookmark = await this.bookmarkItemService.createMusic(
      playlist._id.toString(),
      musicId,
      userId,
    );
    // bump count by 1
    await this.adjustPostCount(playlist._id.toString(), userId, 1);
    return bookmark;
  }

  // soft-delete a music from playlist
  async removeMusicFromPlaylist(userId: string, musicId: string) {
    const playlist = await this.findMusicPlaylist(userId);
    const removedCount = await this.bookmarkItemService.removeMusic(
      playlist._id.toString(),
      musicId,
      userId,
    );
    // decrement by however many we removed (should be 1)
    await this.adjustPostCount(playlist._id.toString(), userId, -removedCount);
    return { removedCount };
  }  

  /** find the user's “All posts” playlist (auto‑creates via findAllByUser) */
  private async findAllPostsPlaylist(userId: string): Promise<BookmarkPlaylistDocument> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    const uid = new Types.ObjectId(userId);

    const playlist = await this.playlistModel.findOne({
      userID: uid,
      playlistName: 'All posts',
      isDeleted: false,
    }).exec();

    if (!playlist) {
      throw new BadRequestException('Could not locate “All posts” playlist');
    }

    return playlist;
  }


  /** add a post to “All posts” by default (resurrects if soft‑deleted) */
  async addPostToDefault(userId: string, postId: string) {
    // get the playlist
    const playlist = await this.findAllPostsPlaylist(userId);

    // delegate to item service
    const bookmark = await this.bookmarkItemService.create(
      playlist._id.toString(),
      postId,
      userId,
    );

    // bump count
    await this.adjustPostCount(playlist._id.toString(), userId, 1);

    return bookmark;
  }
  
  /**
   * Move a post from whatever playlist it's in (if any) into `newPlaylistId`.
   * - If not in any playlist -> add it there.
   * - If already in `newPlaylistId` and active -> throw.
   * - If in another playlist -> reassign, bump new count, decrement old count.
   * - If there's a soft‑deleted bookmark for this user+post in `newPlaylistId`, resurrect it.
   */
  async switchPostPlaylist(
    userId: string,
    newPlaylistId: string,
    postId: string,
  ) {
    // ensure target exists & belongs to user
    const target = await this.findByIdAndUser(newPlaylistId, userId);

    if (target.playlistName == 'Music') {
      throw new BadRequestException(`Incompatible playlist item type and playlist type.`);
    }

    // find any existing bookmark for this user+post across all their playlists
    const allPlaylists = await this.findAllByUser(userId);
    const userPlaylistIds = allPlaylists.map(p => p._id);

    const existing = await this.bookmarkItemModel
      .findOne({ itemID: new Types.ObjectId(postId), playlistID: { $in: userPlaylistIds } })
      .exec();

    // CASE 1: not in any playlist -> just create
    if (!existing) {
      const bookmark = await this.bookmarkItemService.create(
        newPlaylistId,
        postId,
        userId,
      );
      await this.adjustPostCount(newPlaylistId, userId, 1);
      return bookmark;
    }

    // CASE 2: already active in target
    if (!existing.isDeleted && existing.playlistID.equals(target._id)) {
      throw new BadRequestException('Post is already bookmarked in that playlist.');
    }

    // CASE 3: soft‑deleted in target -> resurrect there
    if (existing.isDeleted && existing.playlistID.equals(target._id)) {
      existing.isDeleted = false;
      await existing.save();
      await this.adjustPostCount(newPlaylistId, userId, 1);
      return existing;
    }

    // CASE 4: active in another playlist -> reassign
    if (!existing.isDeleted && !existing.playlistID.equals(target._id)) {
      const oldPlaylistId = existing.playlistID.toString();
      existing.playlistID = target._id;
      await existing.save();
      // adjust both counts
      await this.adjustPostCount(oldPlaylistId, userId, -1);
      await this.adjustPostCount(newPlaylistId, userId, 1);
      return existing;
    }

    // CASE 5: soft‑deleted somewhere else? treat like create
    existing.isDeleted = false;
    existing.playlistID = target._id;
    await existing.save();
    await this.adjustPostCount(newPlaylistId, userId, 1);
    return existing;
  }  
}

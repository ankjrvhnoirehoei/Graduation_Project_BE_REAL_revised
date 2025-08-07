import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
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

import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Post, PostDocument } from 'src/post/post.schema';
import { CommonServices } from 'src/admin/helpers/helpers.service';

@Injectable()
export class BookmarkPlaylistService {
  private readonly PROTECTED = ['Tất cả bài đăng', 'Âm nhạc'];
  constructor(
    @InjectModel(BookmarkPlaylist.name)
    private readonly playlistModel: Model<BookmarkPlaylistDocument>,
    @Inject(forwardRef(() => BookmarkItemService))
    private readonly bookmarkItemService: BookmarkItemService,
    @InjectModel(BookmarkItem.name) 
    private readonly bookmarkItemModel: Model<BookmarkItemDocument>,
    @InjectModel(Media.name)
    private readonly mediaModel: Model<MediaDocument>,
    @InjectModel(Music.name)
    private readonly musicModel: Model<MusicDocument>,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
    private readonly helpersService: CommonServices,
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

    // 1) Load existing playlists
    let playlists = await this.playlistModel
      .find({ userID: uid, isDeleted: false })
      .sort({ createdAt: 1 })
      .exec();

    // 2) If none exist, insert defaults and reload
    if (playlists.length === 0) {
      const defaults = [
        { userID: uid, playlistName: 'Tất cả bài đăng' },
        { userID: uid, playlistName: 'Âm nhạc' },
      ];
      await this.playlistModel.insertMany(defaults);
      playlists = await this.playlistModel
        .find({ userID: uid, isDeleted: false })
        .sort({ createdAt: 1 })
        .exec();
    }

    // 3) Enrich each with filtered thumbnails and mark blocked/hidden items as deleted
    return this.addFilteredThumbnails(playlists, uid);
  }

  /**
   * Generate thumbnails for playlists while filtering out blocked users and hidden posts
   * Also marks filtered items as deleted
   */
  private async addFilteredThumbnails(
    playlists: BookmarkPlaylistDocument[],
    currentUserId: Types.ObjectId,
  ): Promise<(BookmarkPlaylist & { thumbnails: string[] })[]> {
    const results = await Promise.all(
      playlists.map(async (playlist) => {
        const thumbnails = await this.getPlaylistThumbnails(playlist._id, currentUserId);
        return {
          playlistId: playlist._id,
          thumbnails,
        };
      }),
    );

    // Reload playlists to get updated postCount values
    const updatedPlaylists = await this.playlistModel
      .find({ 
        _id: { $in: playlists.map(p => p._id) }, 
        isDeleted: false 
      })
      .sort({ createdAt: 1 })
      .exec();

    // Combine updated playlist data with thumbnails
    return updatedPlaylists.map(playlist => {
      const result = results.find(r => r.playlistId.equals(playlist._id));
      return {
        ...playlist.toObject(),
        thumbnails: result?.thumbnails || ['', '', '', ''],
      };
    });
  }

  /**
   * Get filtered thumbnails for a specific playlist
   */
  private async getPlaylistThumbnails(
    playlistId: Types.ObjectId,
    currentUserId: Types.ObjectId,
  ): Promise<string[]> {
    // Get bookmark items for this playlist (get more initially since some will be filtered)
    const bookmarkItems = await this.bookmarkItemModel
      .find({ playlistID: playlistId, isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(50) // Get more items initially since some might be filtered out
      .exec();

    if (bookmarkItems.length === 0) {
      return ['', '', '', ''];
    }

    const thumbnails: string[] = [];
    const itemsToMarkDeleted: Types.ObjectId[] = [];

    // Process items to get thumbnails
    for (const item of bookmarkItems) {
      if (thumbnails.length >= 4) break;

      if (item.itemType === 'music') {
        // Handle music items - these typically don't need filtering for blocks/hidden
        const music = await this.musicModel
          .findById(item.itemID)
          .select('coverImg')
          .exec();
        
        if (music?.coverImg) {
          thumbnails.push(music.coverImg);
        }
      } else {
        // Handle post/reel items - need filtering
        const mediaResult = await this.getFilteredMediaForPost(
          item.itemID,
          currentUserId,
        );
        
        if (mediaResult.shouldDelete) {
          // Mark this bookmark item for deletion
          itemsToMarkDeleted.push(item._id);
        } else if (mediaResult.media) {
          const thumbnailUrl = await this.processMediaForThumbnail(mediaResult.media);
          if (thumbnailUrl) {
            thumbnails.push(thumbnailUrl);
          }
        }
      }
    }

    // Mark blocked/hidden items as deleted and adjust post count
    if (itemsToMarkDeleted.length > 0) {
      await this.bookmarkItemModel.updateMany(
        { _id: { $in: itemsToMarkDeleted } },
        { $set: { isDeleted: true } }
      ).exec();

      // Decrease the playlist's postCount by the number of deleted items
      await this.playlistModel.updateOne(
        { _id: playlistId },
        { $inc: { postCount: -itemsToMarkDeleted.length } }
      ).exec();
    }

    // If we don't have enough thumbnails after filtering, try to get more
    if (thumbnails.length < 4 && itemsToMarkDeleted.length > 0) {
      // Recursively call to get more items now that some are marked as deleted
      const additionalThumbnails = await this.getPlaylistThumbnails(playlistId, currentUserId);
      // Merge results but avoid duplicates and limit to 4
      const mergedThumbnails = [...new Set([...thumbnails, ...additionalThumbnails])];
      return this.padThumbnails(mergedThumbnails.slice(0, 4));
    }

    return this.padThumbnails(thumbnails);
  }

  /**
   * Pad thumbnails array to exactly 4 items
   */
  private padThumbnails(thumbnails: string[]): string[] {
    while (thumbnails.length < 4) {
      thumbnails.push('');
    }
    return thumbnails.slice(0, 4);
  }

  /**
   * Get media for a post while applying the same filters as the main feed
   * Returns both the media and whether the item should be marked as deleted
   */
  private async getFilteredMediaForPost(
    postId: Types.ObjectId,
    currentUserId: Types.ObjectId,
  ): Promise<{
    media: { videoUrl?: string; imageUrl?: string; postID: Types.ObjectId } | null;
    shouldDelete: boolean;
  }> {
    try {
      // Use the helpers service pipeline logic to check if this post should be visible
      const pipeline = this.helpersService.buildBasePipeline(
        currentUserId,
        { _id: postId }
      );

      // Add media lookup to the pipeline
      pipeline.push(
        {
          $lookup: {
            from: 'media',
            localField: '_id',
            foreignField: 'postID',
            as: 'media',
          },
        },
        {
          $unwind: {
            path: '$media',
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $project: {
            'media.videoUrl': 1,
            'media.imageUrl': 1,
            'media.postID': 1,
            isBlocked: 1, // We need this to determine if item should be deleted
          },
        }
      );

      const result = await this.postModel.aggregate(pipeline).exec();
      
      if (result.length === 0) {
        // Post was filtered out (blocked/hidden), mark for deletion
        return { media: null, shouldDelete: true };
      }

      const post = result[0];
      
      // If post is blocked, mark for deletion
      if (post.isBlocked) {
        return { media: null, shouldDelete: true };
      }

      return { 
        media: post.media || null, 
        shouldDelete: false 
      };
      
    } catch (error) {
      console.error('Error filtering post:', error);
      // On error, assume post should be deleted to be safe
      return { media: null, shouldDelete: true };
    }
  }

  /**
   * Process media URL to generate thumbnail if it's a video
   * Returns base64 encoded image for videos, original URL for images
   */
  private async processMediaForThumbnail(media: {
    videoUrl?: string;
    imageUrl?: string;
    postID: Types.ObjectId;
  }): Promise<string | null> {
    // If it's an image, return as is
    if (media.imageUrl) {
      return media.imageUrl;
    }

    // If it's a video, generate thumbnail
    if (media.videoUrl && media.videoUrl.endsWith('.mp4')) {
      try {
        return await this.generateVideoThumbnailBase64(media.videoUrl);
      } catch (error) {
        console.error('Error generating video thumbnail:', error);
        // Fallback to video URL if thumbnail generation fails
        return media.videoUrl;
      }
    }

    return null;
  }

  /**
   * Generate base64 thumbnail from video using ffmpeg
   * No storage needed - returns base64 data URL
   */
  private async generateVideoThumbnailBase64(videoUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create temporary file path
      const tempDir = os.tmpdir();
      const tempFileName = `thumb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
      const tempPath = path.join(tempDir, tempFileName);

      // Generate thumbnail using ffmpeg
      ffmpeg(videoUrl)
        .screenshots({
          timestamps: ['00:00:01'], // Take screenshot at 1 second
          filename: tempFileName,
          folder: tempDir,
          size: '320x240', // Smaller size for faster processing and smaller base64
        })
        .on('end', async () => {
          try {
            // Read the generated image and convert to base64
            const imageBuffer = fs.readFileSync(tempPath);
            const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
            
            // Clean up temporary file
            fs.unlinkSync(tempPath);
            
            resolve(base64Image);
          } catch (error) {
            // Clean up on error
            try {
              fs.unlinkSync(tempPath);
            } catch {}
            reject(error);
          }
        })
        .on('error', (err) => {
          // Clean up on error
          try {
            fs.unlinkSync(tempPath);
          } catch {}
          console.error('FFmpeg error:', err);
          reject(err);
        });
    });
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

    // create and return - ADD the _id generation
    const created = new this.playlistModel({
      _id: new Types.ObjectId(), 
      userID: objectUserId,
      playlistName,
      postCount: 0,
      isDeleted: false,
    });
    return created.save();
  }

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
      throw new BadRequestException('Cần có tên danh sách mới.');
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
      throw new BadRequestException('Bạn đã có 1 danh sách với tên này.');
    }

    // update fields
    playlist.playlistName = newName;
    if (coverImg !== undefined) {
      playlist.coverImg = coverImg;
    }
    return playlist.save();
  }

  async deletePlaylist(userId: string, playlistId: string): Promise<{
    playlistDeleted: boolean;
    itemsDeleted: number;
  }> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(playlistId)) {
      throw new BadRequestException('Invalid ID format.');
    }
    const uid = new Types.ObjectId(userId);
    const pid = new Types.ObjectId(playlistId);

    // 1) fetch & validate ownership
    const playlist = await this.playlistModel.findOne({
      _id: pid,
      userID: uid,
      isDeleted: false,
    });
    if (!playlist) {
      throw new NotFoundException('Không tìm thấy danh sách.');
    }

    // 2) protect special playlists
    if (this.PROTECTED.includes(playlist.playlistName)) {
      throw new BadRequestException(`Không được xóa danh sách '${playlist.playlistName}'.`);
    }

    // 3) soft-delete the playlist
    const plUpdate = await this.playlistModel.updateOne(
      { _id: pid },
      { $set: { isDeleted: true } },
    );

    // 4) soft-delete all its items
    const itemsDeleted = await this.bookmarkItemService.markItemsDeletedByPlaylist(playlistId);

    return {
      playlistDeleted: plUpdate.modifiedCount === 1,
      itemsDeleted,
    };
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
      playlistName: { $in: ['Âm nhạc', 'Music'] },
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
    if (playlist.playlistName !== 'Music' && playlist.playlistName !== 'Âm nhạc') {
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
      playlistName: { $in: ['All posts', 'Tất cả bài đăng'] },
      isDeleted: false,
    }).exec();

    if (!playlist) {
      await this.findAllByUser(userId);
      const newPlaylist = await this.playlistModel.findOne({
        userID: uid,
        playlistName: { $in: ['All posts', 'Tất cả bài đăng'] },
        isDeleted: false,
      }).exec();
      return newPlaylist
    } else {
      return playlist;
    }
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
  async switchPostsPlaylist(
    userId: string,
    newPlaylistId: string,
    postIds: string[],
  ) {
    // Ensure target playlist exists & belongs to user
    const target = await this.findByIdAndUser(newPlaylistId, userId);

    if (target.playlistName === 'Music' || target.playlistName === 'Âm nhạc') {
      throw new BadRequestException(`Incompatible playlist item type and playlist type.`);
    }

    // Get all user's playlists for lookup
    const allPlaylists = await this.findAllByUser(userId);
    const userPlaylistIds = allPlaylists.map(p => p._id);

    // Find all existing bookmarks for these posts across user's playlists
    const postObjectIds = postIds.map(id => new Types.ObjectId(id));
    const existingBookmarks = await this.bookmarkItemModel
      .find({ 
        itemID: { $in: postObjectIds }, 
        playlistID: { $in: userPlaylistIds } 
      })
      .exec();

    // Create a map for quick lookup: postId -> existing bookmark
    const bookmarkMap = new Map<string, any>();
    existingBookmarks.forEach(bookmark => {
      bookmarkMap.set(bookmark.itemID.toString(), bookmark);
    });

    // Track playlist count changes
    const playlistCountChanges = new Map<string, number>();
    const results: Array<{ 
      postId: string; 
      action: string; 
      bookmark?: any; 
      message?: string;
      error?: string;
    }> = [];

    // Process each post
    for (const postId of postIds) {
      const existing = bookmarkMap.get(postId);

      try {
        // CASE 1: not in any playlist -> create new
        if (!existing) {
          try {
            const bookmark = await this.bookmarkItemService.create(
              newPlaylistId,
              postId,
              userId,
            );
            this.adjustCountChange(playlistCountChanges, newPlaylistId, 1);
            results.push({ postId, action: 'created', bookmark });
          } catch (error) {
            // Handle duplicate key error - item might already exist
            if (error.code === 11000) {
              // Re-query to find the existing bookmark
              const existingBookmark = await this.bookmarkItemModel
                .findOne({ 
                  itemID: new Types.ObjectId(postId), 
                  playlistID: new Types.ObjectId(newPlaylistId)
                })
                .exec();
              
              if (existingBookmark && !existingBookmark.isDeleted) {
                results.push({ 
                  postId, 
                  action: 'already_exists', 
                  message: 'Post is already bookmarked in that playlist.',
                  bookmark: existingBookmark 
                });
              } else {
                throw error; // Re-throw if it's not the expected scenario
              }
            } else {
              throw error; // Re-throw non-duplicate key errors
            }
          }
          continue;
        }

        // CASE 2: already active in target playlist
        if (!existing.isDeleted && existing.playlistID.equals(target._id)) {
          results.push({ 
            postId, 
            action: 'already_exists', 
            message: 'Post is already bookmarked in that playlist.',
            bookmark: existing 
          });
          continue;
        }

        // CASE 3: soft-deleted in target -> resurrect
        if (existing.isDeleted && existing.playlistID.equals(target._id)) {
          existing.isDeleted = false;
          await existing.save();
          this.adjustCountChange(playlistCountChanges, newPlaylistId, 1);
          results.push({ postId, action: 'resurrected', bookmark: existing });
          continue;
        }

        // CASE 4: active in another playlist -> reassign
        if (!existing.isDeleted && !existing.playlistID.equals(target._id)) {
          const oldPlaylistId = existing.playlistID.toString();
          existing.playlistID = target._id;
          await existing.save();
          
          // Adjust counts for both playlists
          this.adjustCountChange(playlistCountChanges, oldPlaylistId, -1);
          this.adjustCountChange(playlistCountChanges, newPlaylistId, 1);
          results.push({ postId, action: 'moved', bookmark: existing });
          continue;
        }

        // CASE 5: soft-deleted somewhere else -> treat like create in new playlist
        existing.isDeleted = false;
        existing.playlistID = target._id;
        await existing.save();
        this.adjustCountChange(playlistCountChanges, newPlaylistId, 1);
        results.push({ postId, action: 'moved_from_deleted', bookmark: existing });

      } catch (error) {
        // If individual post fails, record the error but continue with others
        results.push({ 
          postId, 
          action: 'error', 
          error: error.message || 'Unknown error occurred' 
        });
      }
    }

    // Apply all playlist count changes in batch
    await this.applyCountChanges(playlistCountChanges, userId);

    return {
      success: true,
      totalProcessed: postIds.length,
      results,
      summary: this.generateSummary(results),
    };
  }

  // Helper method to track count changes
  private adjustCountChange(countChanges: Map<string, number>, playlistId: string, delta: number): void {
    const current = countChanges.get(playlistId) || 0;
    countChanges.set(playlistId, current + delta);
  }

  // Helper method to apply all count changes
  private async applyCountChanges(countChanges: Map<string, number>, userId: string): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [playlistId, delta] of countChanges.entries()) {
      if (delta !== 0) {
        promises.push(this.adjustPostCount(playlistId, userId, delta));
      }
    }
    await Promise.all(promises);
  }

  // Helper method to generate a summary of actions
  private generateSummary(results: any[]): any {
    const summary = {
      created: 0,
      moved: 0,
      resurrected: 0,
      already_exists: 0,
      errors: 0,
    };

    results.forEach(result => {
      switch (result.action) {
        case 'created':
          summary.created++;
          break;
        case 'moved':
        case 'moved_from_deleted':
          summary.moved++;
          break;
        case 'resurrected':
          summary.resurrected++;
          break;
        case 'already_exists':
          summary.already_exists++;
          break;
        case 'error':
          summary.errors++;
          break;
      }
    });

    return summary;
  }
}

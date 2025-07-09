import {
  Controller,
  Get,
  Param,
  UseGuards,
  BadRequestException,
  Post,
  Body,
  Delete,
} from '@nestjs/common';
import { BookmarkPlaylistService } from './bookmark-playlist.service';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { BookmarkItemService } from 'src/bookmark-item/bookmark-item.service';

@Controller('bookmark-playlists')
export class BookmarkPlaylistController {
  constructor(
    private readonly playlistService: BookmarkPlaylistService,
    private readonly itemService: BookmarkItemService,
  ) {}

  /**
   * returns all non-deleted playlists for the current user.
   * if none exist, creates the two defaults ("All posts" and "Music") first.
   */
  @Get('all')
  @UseGuards(JwtRefreshAuthGuard)
  async getAllPlaylists(@CurrentUser('sub') userId: string) {
    return this.playlistService.findAllByUser(userId);
  }

  // creates a new playlist for the current user
  @Post('add')
  @UseGuards(JwtRefreshAuthGuard)
  async createPlaylist(
    @Body('playlistName') playlistName: string,
    @CurrentUser('sub') userId: string,
  ) {
    if (!playlistName || typeof playlistName !== 'string') {
      throw new BadRequestException('Thiếu playlistName và phải là chuỗi.');
    }
    return this.playlistService.createPlaylist(userId, playlistName);
  }

  // renames an existing playlist
  @Post('rename')
  @UseGuards(JwtRefreshAuthGuard)
  async renamePlaylist(
    @Body('id') playlistId: string,
    @Body('playlistName') playlistName: string,
    @CurrentUser('sub') userId: string,
  ) {
    if (!playlistName || typeof playlistName !== 'string') {
      throw new BadRequestException('Thiếu playlistName và phải là chuỗi.');
    }
    return this.playlistService.renamePlaylist(playlistId, userId, playlistName);
  }

  // bookmark a post into a given playlist
  @UseGuards(JwtRefreshAuthGuard)
  @Post('add-bookmark')
  async bookmarkPost(
    @Body('postId') postId: string,
    @Body('playlistId') playlistId: string,
    @CurrentUser('sub') userId: string,
  ) {
    if (!playlistId) {
      throw new BadRequestException('Thiếu playlistId trong body.');
    }
    if (!postId) {
      throw new BadRequestException('Thiếu postId trong body.');
    }
    // Create the bookmark item first
    const bookmarkItem = await this.itemService.create(playlistId, postId, userId);

    // If bookmark creation was successful, increment the playlist's postCount
    await this.playlistService.adjustPostCount(playlistId, userId, 1);

    return bookmarkItem;
  }

  // remove 1 or many posts from a playlist
  @Delete('remove-bookmark')
  @UseGuards(JwtRefreshAuthGuard)
  async removePostsFromPlaylist(
    @Body('postId') postIds: string[],
    @Body('playlistId') playlistId: string,
    @CurrentUser('sub') userId: string,
  ) {
    if (!playlistId) {
      throw new BadRequestException('Thiếu playlistId trong body.');
    }
    if (!Array.isArray(postIds) || postIds.length === 0) {
      throw new BadRequestException('Cần postId dạng array trong body.');
    }

    await this.playlistService.findByIdAndUser(playlistId, userId);

    // soft-delete those bookmark items
    const removedCount = await this.itemService.removeMultiple(
      playlistId,
      postIds,
      userId,
    );

    // decrement playlist.postCount by the number of removed items
    if (removedCount > 0) {
      await this.playlistService.adjustPostCount(playlistId, userId, -removedCount);
    }

    return { removedCount };
  }

  // add music to playlist
  @Post('music/add')
  @UseGuards(JwtRefreshAuthGuard)
  async addMusic(
    @Body('musicId') musicId: string,
    @CurrentUser('sub') userId: string,
  ) {
    console.log('userID: ', userId);
    if (!musicId) {
      throw new BadRequestException('Thiếu musicId.');
    }
    return this.playlistService.addMusicToPlaylist(userId, musicId);
  }

  // soft delete it
  @Delete('music/remove')
  @UseGuards(JwtRefreshAuthGuard)
  async removeMusic(
    @Body('musicId') musicId: string,
    @CurrentUser('sub') userId: string,
  ) {
    if (!musicId) {
      throw new BadRequestException('Thiếu musicId.');
    }
    return this.playlistService.removeMusicFromPlaylist(userId, musicId);
  }  

  /** POST /bookmark-playlists/add-default */
  @Post('add-default')
  @UseGuards(JwtRefreshAuthGuard)
  async addToAllPosts(
    @Body('postId') postId: string,
    @CurrentUser('sub') userId: string,
  ) {
    if (!postId) {
      throw new BadRequestException('Thiếu postId.');
    }
    return this.playlistService.addPostToDefault(userId, postId);
  }

  /** POST /bookmark-playlists/switch */
  @Post('switch')
  @UseGuards(JwtRefreshAuthGuard)
  async switchPlaylist(
    @Body('playlistId') playlistId: string,
    @CurrentUser('sub') userId: string,
    @Body('postId') postId?: string,
    @Body('postIds') postIds?: string[],
  ) {
    if (!playlistId) {
      throw new BadRequestException('Thiếu playlistId.');
    }

    // Handle both single postId and multiple postIds
    let idsToProcess: string[] = [];
    
    if (postIds && Array.isArray(postIds) && postIds.length > 0) {
      idsToProcess = postIds;
    } else if (postId) {
      idsToProcess = [postId];
    } else {
      throw new BadRequestException('Cần có 1 postId hoặc array postId.');
    }

    // Validate all IDs are provided
    if (idsToProcess.some(id => !id || typeof id !== 'string')) {
      throw new BadRequestException('Tất cả IDs phải là chuỗi hợp lệ.');
    }

    return this.playlistService.switchPostsPlaylist(userId, playlistId, idsToProcess);
  }
}

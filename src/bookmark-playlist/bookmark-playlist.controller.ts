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
      throw new BadRequestException('playlistName is required and must be a string.');
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
      throw new BadRequestException('playlistName is required and must be a string.');
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
      throw new BadRequestException('playlistId is required in the request body.');
    }
    if (!postId) {
      throw new BadRequestException('postId is required in the request body.');
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
      throw new BadRequestException('playlistId is required in the request body.');
    }
    if (!Array.isArray(postIds) || postIds.length === 0) {
      throw new BadRequestException('postIds (array of strings) is required in the request body.');
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
      throw new BadRequestException('musicId is required.');
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
      throw new BadRequestException('musicId is required.');
    }
    return this.playlistService.removeMusicFromPlaylist(userId, musicId);
  }  

  /**
   * For the current user:
   *  - load all their non-deleted playlists
   *  - for each, check if `itemId` is already bookmarked
   */
  @Get('contains/:itemId')
  @UseGuards(JwtRefreshAuthGuard)
  async checkItemInPlaylists(
    @Param('itemId') itemId: string,
    @CurrentUser('sub') userId: string,
  ) {
    // fetch every non-deleted playlist
    const playlists = await this.playlistService.findAllByUser(userId);

    // for each playlist, ask BookmarkItemService if it exists
    const result = await Promise.all(
      playlists.map(async (pl) => ({
        playlistId:   pl._id.toString(),
        playlistName: pl.playlistName,
        hasItem:      await this.itemService.exists(pl._id.toString(), itemId),
      }))
    );

    return { itemId, playlists: result };
  }  
}

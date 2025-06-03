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

  // /**
  //  * returns all non-deleted items for the given playlist ID,
  //  * but only if that playlist belongs to the current user.
  //  */
  // @Get(':id/items')
  // @UseGuards(JwtRefreshAuthGuard)
  // async getItemsInPlaylist(
  //   @Param('id') playlistId: string,
  //   @CurrentUser('sub') userId: string,
  // ) {
  //   await this.playlistService.findByIdAndUser(playlistId, userId);
  //   return this.itemService.findAllByPlaylist(playlistId);
  // }

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
}

import {
  Controller,
  Get,
  Param,
  UseGuards,
  BadRequestException,
  Query,
  Delete,
  Body,
} from '@nestjs/common';
import { BookmarkItemService } from './bookmark-item.service';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('bookmark-items')
export class BookmarkItemController {
  constructor(private readonly itemService: BookmarkItemService) {}

  /**
   * returns all non-deleted items in that playlist
   * ensures the playlist belongs to the current user
   */
  @Get('all/:playlistId')
  @UseGuards(JwtRefreshAuthGuard)
  async getItemsByPlaylist(
    @Param('playlistId') playlistId: string,
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);

    if (pageNum < 1) throw new BadRequestException('Page must be ≥ 1');
    if (limitNum < 1 || limitNum > 50)
      throw new BadRequestException('Limit must be between 1 and 50');

    // ensure user actually owns it
    await this.itemService.validatePlaylistOwnership(playlistId, userId);

    const { data, total } = await this.itemService
      .findAllByPlaylist(playlistId, userId, pageNum, limitNum);

    const totalPages = Math.max(Math.ceil(total / limitNum), 1);

    return {
      message: 'Bookmark items retrieved successfully',
      data,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount: total,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      }
    };
  }

  /** DELETE /bookmark-items/remove */
  @Delete('remove')
  @UseGuards(JwtRefreshAuthGuard)
  async removeDefault(
    @Body('postIds') postIds: string | string[], // Accept both single string and array
    @CurrentUser('sub') userId: string,
  ) {
    // Normalize input to always be an array
    const postIdArray = Array.isArray(postIds) ? postIds : [postIds];
    
    if (!postIdArray.length || postIdArray.some(id => !id)) {
      throw new BadRequestException('At least one valid postId is required.');
    }

    const result = await this.itemService.removeByUserAndPosts(userId, postIdArray);
    
    return { 
      message: `${result.deletedCount} bookmark(s) removed.`,
      deletedCount: result.deletedCount,
      notFoundCount: result.notFoundCount,
      details: result.details
    };
  }
}

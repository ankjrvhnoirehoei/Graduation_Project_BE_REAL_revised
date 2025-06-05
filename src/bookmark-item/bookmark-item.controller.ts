import {
  Controller,
  Get,
  Param,
  UseGuards,
  BadRequestException,
  Query,
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
  const pageNum = parseInt(page || '1') || 1;
  const limitNum = parseInt(limit || '20') || 20;

  // Validate pagination parameters
  if (pageNum < 1) {
    throw new BadRequestException('Page must be greater than 0');
  }
  if (limitNum < 1 || limitNum > 50) {
    throw new BadRequestException('Limit must be between 1 and 50');
  }

  // Validate ownership
  await this.itemService.validatePlaylistOwnership(playlistId, userId);
  
  const result = await this.itemService.findAllByPlaylist(playlistId, pageNum, limitNum);
  
  return {
    message: 'Bookmark items retrieved successfully',
    items: result.items,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(result.total / limitNum),
      totalCount: result.total,
      limit: limitNum,
      hasNextPage: pageNum < Math.ceil(result.total / limitNum),
      hasPrevPage: pageNum > 1
    }
  };
}
}

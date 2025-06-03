import {
  Controller,
  Get,
  Param,
  UseGuards,
  BadRequestException,
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
  ) {
    // internally, findAllByPlaylist does not check ownership;
    // so first validate ownership via a helper
    await this.itemService.validatePlaylistOwnership(playlistId, userId);
    return this.itemService.findAllByPlaylist(playlistId);
  }
}

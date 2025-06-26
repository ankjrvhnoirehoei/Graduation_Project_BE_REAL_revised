import { Controller, Get, Patch, Body, Query, UseGuards, Param, Delete } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtRefreshAuthGuard)
export class NotificationController {
  constructor(private readonly svc: NotificationService) {}

  @Get('all')
  getAll(
  @CurrentUser('sub') userId: string,
  @Query('onlyUnread') onlyUnread?: string,
  @Query('limit') limit = '50'
  ) {
    return this.svc.getNotificationsByUser(userId, {
        unreadOnly: onlyUnread === 'true',
        limit: +limit,
    });
  }

  @Patch('read/:id')
  markRead(@Param('id') id: string) {
    return this.svc.markAsRead(id);
  }

  @Patch('read-all')
  markAll(@CurrentUser('sub') userId: string) {
    return this.svc.markAllAsRead(userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.deleteNotification(id);
  }
}


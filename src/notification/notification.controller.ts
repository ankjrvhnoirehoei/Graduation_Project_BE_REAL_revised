import { Controller, Post, Body, Get, UseGuards, Query, Param } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SendNotificationDto } from './dto/sendNoti.dto';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @UseGuards(JwtRefreshAuthGuard)
  @Post('send')
  async sendNotification(
    @Body() body: SendNotificationDto,
    @CurrentUser('sub') userId: string,
  ) {
    const { receiverIds, title, body: messageBody, data } = body;

    const result = await this.notificationService.sendPushNotification(
      receiverIds,
      userId,
      title,
      messageBody,
      data,
    );

    return {
      success: result.success,
      message: result.success
        ? 'Notification sent successfully'
        : 'Failed to send notification',
      error: result.error || null,
    };
  }

  @UseGuards(JwtRefreshAuthGuard)
  @Get()
  async getNotifications(
    @CurrentUser('sub') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const { data, pagination } =
      await this.notificationService.getNotificationsForUser(
        userId,
        pageNum,
        limitNum,
      );

    return {
      success: true,
      data,
      pagination,
    };
  }

  @UseGuards(JwtRefreshAuthGuard)
  @Post(':notificationId/read')
  async markNotificationAsRead(
    @CurrentUser('sub') userId: string,
    @Param('notificationId') notificationId: string,
  ) {
    await this.notificationService.markNotificationAsRead(userId, notificationId);

    return {
      success: true,
      message: 'Notification marked as read',
    };
  }
}

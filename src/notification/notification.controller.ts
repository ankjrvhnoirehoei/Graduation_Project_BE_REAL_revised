import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
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
  async getNotifications(@CurrentUser('sub') userId: string) {
    const notifications =
      await this.notificationService.getNotificationsForUser(userId);

    return {
      success: true,
      notifications,
    };
  }
}

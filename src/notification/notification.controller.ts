import { Controller, Post, Body } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('send')
  async send(@Body() body: any) {
    const {
      receiverIds,
      senderId,
      title,
      body: messageBody,
      data,
    } = body;

    const result = await this.notificationService.sendPushNotification(
      receiverIds,
      senderId,
      title,
      messageBody,
      data,
    );

    return {
      message: result.success
        ? 'Notification sent successfully'
        : 'Failed to send notification',
      success: result.success,
      error: result.error || null,
    };
  }
}

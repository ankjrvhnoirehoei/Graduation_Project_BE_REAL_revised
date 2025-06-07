import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';
import { NotificationService } from './notificate.service';
import { ApiResponse } from '@app/common';
import { NotificationListResponseDto, GetNotificationsDto, MarkAsReadDto } from './dto/create-notificate.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications with pagination and filters' })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    response: NotificationListResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  async getNotifications(
    @Req() req: Request,
    @Query() query: GetNotificationsDto,
  ) {
    const userId = (req as any).user?.id || req.headers['user-id']; // Adjust based on your auth implementation
    const result = await this.notificationService.getNotifications(userId, query);
    
    return {
      statusCode: HttpStatus.OK,
      message: 'Notifications retrieved successfully',
      data: result,
    };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
    response: { type: Number, description: 'Number of unread notifications' },
  })
  async getUnreadCount(@Req() req: Request) {
    const userId = (req as any).user?.id || req.headers['user-id'];
    const count = await this.notificationService.getUnreadCount(userId);
    
    return {
      statusCode: HttpStatus.OK,
      message: 'Unread count retrieved successfully',
      data: { unreadCount: count },
    };
  }

  @Post('mark-as-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'Notifications marked as read successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body',
  })
  async markAsRead(
    @Req() req: Request,
    @Body() dto: MarkAsReadDto,
  ) {
    const userId = (req as any).user?.id || req.headers['user-id'];
    await this.notificationService.markAsRead(userId, dto);
    
    return {
      statusCode: HttpStatus.OK,
      message: dto.notification_ids && dto.notification_ids.length > 0
        ? `${dto.notification_ids.length} notifications marked as read successfully`
        : 'All notifications marked as read successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found or access denied',
  })
  async deleteNotification(
    @Req() req: Request,
    @Param('id') notificationId: string,
  ) {
    const userId = (req as any).user?.id || req.headers['user-id'];
    await this.notificationService.deleteNotification(notificationId, userId);
    
    return {
      statusCode: HttpStatus.OK,
      message: 'Notification deleted successfully',
    };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete multiple notifications' })
  @ApiResponse({
    status: 200,
    description: 'Notifications deleted successfully',
  })
  async deleteMultipleNotifications(
    @Req() req: Request,
    @Body() dto: { notification_ids: string[] },
  ) {
    const userId = (req as any).user?.id || req.headers['user-id'];
    
    // Delete notifications one by one to ensure proper validation
    for (const notificationId of dto.notification_ids) {
      await this.notificationService.deleteNotification(notificationId, userId);
    }
    
    return {
      statusCode: HttpStatus.OK,
      message: `${dto.notification_ids.length} notifications deleted successfully`,
    };
  }
}
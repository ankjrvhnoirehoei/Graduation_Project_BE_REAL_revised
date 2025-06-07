import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { NotificationRepository as mRepo } from './notificate.repository';
import { CreateNotificationDto, GetNotificationsDto, MarkAsReadDto, NotificationListResponseDto } from './dto/create-notificate.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly mRepo: mRepo,
  ) {}

  async getNotifications(
    userId: string,
    query: GetNotificationsDto
  ): Promise<NotificationListResponseDto> {
    try {
      const result = await this.mRepo.findByUserId(userId, {
        type: query.type,
        is_read: query.is_read,
        page: query.page || 1,
        limit: query.limit || 20,
      });

      return {
        notifications: result.notifications.map(notification => ({
          _id: notification._id.toString(),
          user_id: notification.user_id.toString(),
          trigger_user_id: notification.trigger_user_id.toString(),
          content: notification.content,
          type: notification.type,
          is_read: notification.is_read,
          created_at: notification.created_at,
          updated_at: notification.updated_at,
          trigger_user: (notification as any).trigger_user_id ? {
            _id: (notification as any).trigger_user_id._id?.toString(),
            username: (notification as any).trigger_user_id.username,
            handleName: (notification as any).trigger_user_id.handleName,
            profilePic: (notification as any).trigger_user_id.profilePic,
          } : undefined,
          post: (notification as any).post_id ? {
            _id: (notification as any).post_id._id?.toString(),
            caption: (notification as any).post_id.caption,
            type: (notification as any).post_id.type,
          } : undefined,
          comment: (notification as any).comment_id ? {
            _id: (notification as any).comment_id._id?.toString(),
            content: (notification as any).comment_id.content,
          } : undefined,
        })),
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
      };
    } catch (error) {
      this.logger.error(`Error getting notifications for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  async markAsRead(userId: string, dto: MarkAsReadDto): Promise<void> {
    try {
      if (dto.notification_ids && dto.notification_ids.length > 0) {
        // Mark specific notifications as read
        await this.mRepo.markAsRead(dto.notification_ids);
        this.logger.log(`Marked ${dto.notification_ids.length} notifications as read for user ${userId}`);
      } else {
        // Mark all notifications as read for the user
        await this.mRepo.markAllAsReadForUser(userId);
        this.logger.log(`Marked all notifications as read for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Error marking notifications as read for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      // Verify the notification exists and belongs to the user
      const notification = await this.mRepo.findOne({
        _id: notificationId,
        user_id: userId,
      });

      if (!notification) {
        throw new NotFoundException('Notification not found or access denied');
      }

      await this.mRepo.deleteNotification(notificationId);
      this.logger.log(`Deleted notification ${notificationId} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error deleting notification ${notificationId}: ${error.message}`);
      throw error;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.mRepo.getUnreadCount(userId);
    } catch (error) {
      this.logger.error(`Error getting unread count for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  // Helper methods for creating notifications
  async createPostLikeNotification(
    postOwnerId: string,
    likerUserId: string,
    postId: string,
    likerUsername: string
  ): Promise<void> {
    // Don't create notification if user likes their own post
    if (postOwnerId === likerUserId) {
      return;
    }

    const content = `${likerUsername} đã thích bài viết của bạn`;
    
    // Check if similar notification already exists
    const existing = await this.mRepo.findSimilarNotification({
      user_id: postOwnerId,
      trigger_user_id: likerUserId,
      type: 'POST_LIKE',
      post_id: postId,
    });

    if (!existing) {
      await this.mRepo.createNotification({
        user_id: postOwnerId,
        trigger_user_id: likerUserId,
        content,
        type: 'COMMENT_LIKE',
        post_id: postId,
      });
      
      this.logger.log(`Created post like notification for user ${postOwnerId}`);
    }
  }

  async createCommentLikeNotification(
    commentOwnerId: string,
    likerUserId: string,
    commentId: string,
    likerUsername: string
  ): Promise<void> {
    // Don't create notification if user likes their own comment
    if (commentOwnerId === likerUserId) {
      return;
    }

    const content = `${likerUsername} đã thích bình luận của bạn`;
    
    // Check if similar notification already exists
    const existing = await this.mRepo.findSimilarNotification({
      user_id: commentOwnerId,
      trigger_user_id: likerUserId,
      type: 'COMMENT_LIKE',
      comment_id: commentId,
    });

    if (!existing) {
      await this.mRepo.createNotification({
        user_id: commentOwnerId,
        trigger_user_id: likerUserId,
        content,
        type: 'COMMENT_LIKE',
        comment_id: commentId,
      });
      
      this.logger.log(`Created comment like notification for user ${commentOwnerId}`);
    }
  }

  async createNewCommentNotification(
    postOwnerId: string,
    commenterUserId: string,
    postId: string,
    commentId: string,
    commenterUsername: string
  ): Promise<void> {
    // Don't create notification if user comments on their own post
    if (postOwnerId === commenterUserId) {
      return;
    }

    const content = `${commenterUsername} đã bình luận về bài viết của bạn`;
    
    await this.mRepo.createNotification({
      user_id: postOwnerId,
      trigger_user_id: commenterUserId,
      content,
      type: 'NEW_COMMENT',
      post_id: postId,
      comment_id: commentId,
    });
    
    this.logger.log(`Created new comment notification for user ${postOwnerId}`);
  }

  async createNewMessageNotification(
    receiverId: string,
    senderId: string,
    messageId: string,
    senderUsername: string
  ): Promise<void> {
    const content = `Bạn có tin nhắn mới từ ${senderUsername}`;
    
    await this.mRepo.createNotification({
      user_id: receiverId,
      trigger_user_id: senderId,
      content,
      type: 'NEW_MESSAGE',
      message_id: messageId,
    });
    
    this.logger.log(`Created new message notification for user ${receiverId}`);
  }

  // Generic method for custom notifications
  async createNotification(dto: CreateNotificationDto): Promise<void> {
    try {
      await this.mRepo.createNotification(dto);
      this.logger.log(`Created custom notification for user ${dto.user_id}`);
    } catch (error) {
      this.logger.error(`Error creating notification: ${error.message}`);
      throw error;
    }
  }
}
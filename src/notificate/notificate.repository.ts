import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { AbstractRepository } from '@app/common';
import { Notification as NotificationDocument, NotificationType } from './schema/notificate.schema';

export interface NotificationFilter {
  user_id: string;
  type?: NotificationType;
  is_read?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class NotificationRepository extends AbstractRepository<NotificationDocument> {
  protected readonly logger = new Logger(NotificationRepository.name);

  constructor(
    @InjectModel(Notification.name) model: Model<NotificationDocument>,
  ) {
    super(model);
  }

  async findByUserId(
    userId: string,
    options: {
      type?: NotificationType;
      is_read?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    notifications: NotificationDocument[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    const { type, is_read, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    // Build filter query
    const filterQuery: FilterQuery<NotificationDocument> = {
      user_id: new Types.ObjectId(userId),
    };

    if (type !== undefined) {
      filterQuery.type = type;
    }

    if (is_read !== undefined) {
      filterQuery.is_read = is_read;
    }

    // Get total count
    const totalCount = await this.model.countDocuments(filterQuery);

    // Get notifications with pagination
    const notifications = await this.model
      .find(filterQuery)
      .populate('trigger_user_id', 'username handleName profilePic')
      .populate('post_id', 'caption type')
      .populate('comment_id', 'content')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean<NotificationDocument[]>();

    return {
      notifications,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  }

  async markAsRead(notificationIds: string[]): Promise<void> {
    await this.model.updateMany(
      { _id: { $in: notificationIds.map(id => new Types.ObjectId(id)) } },
      { 
        $set: { 
          is_read: true,
          updated_at: new Date()
        } 
      }
    );
  }

  async markAllAsReadForUser(userId: string): Promise<void> {
    await this.model.updateMany(
      { 
        user_id: new Types.ObjectId(userId),
        is_read: false
      },
      { 
        $set: { 
          is_read: true,
          updated_at: new Date()
        } 
      }
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.model.countDocuments({
      user_id: new Types.ObjectId(userId),
      is_read: false,
    });
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await this.model.deleteOne({ _id: new Types.ObjectId(notificationId) });
  }

  async createNotification(data: {
    user_id: string;
    trigger_user_id: string;
    content: string;
    type: NotificationType;
    post_id?: string;
    comment_id?: string;
    message_id?: string;
  }): Promise<NotificationDocument> {
    const notification = new this.model({
      _id: new Types.ObjectId(),
      user_id: new Types.ObjectId(data.user_id),
      trigger_user_id: new Types.ObjectId(data.trigger_user_id),
      content: data.content,
      type: data.type,
      post_id: data.post_id ? new Types.ObjectId(data.post_id) : undefined,
      comment_id: data.comment_id ? new Types.ObjectId(data.comment_id) : undefined,
      message_id: data.message_id ? new Types.ObjectId(data.message_id) : undefined,
      is_read: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return (await notification.save()).toJSON() as unknown as NotificationDocument;
  }

  // Check if similar notification already exists to avoid duplicates
  async findSimilarNotification(data: {
    user_id: string;
    trigger_user_id: string;
    type: NotificationType;
    post_id?: string;
    comment_id?: string;
    message_id?: string;
  }): Promise<NotificationDocument | null> {
    const filterQuery: FilterQuery<NotificationDocument> = {
      user_id: new Types.ObjectId(data.user_id),
      trigger_user_id: new Types.ObjectId(data.trigger_user_id),
      type: data.type,
    };

    if (data.post_id) {
      filterQuery.post_id = new Types.ObjectId(data.post_id);
    }

    if (data.comment_id) {
      filterQuery.comment_id = new Types.ObjectId(data.comment_id);
    }

    if (data.message_id) {
      filterQuery.message_id = new Types.ObjectId(data.message_id);
    }

    return this.model.findOne(filterQuery).lean<NotificationDocument>();
  }
}
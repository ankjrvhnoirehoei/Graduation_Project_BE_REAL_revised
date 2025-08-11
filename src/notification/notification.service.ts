import { Injectable } from '@nestjs/common';
import admin from '../firebase';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './notification.schema';
import { User, UserDocument } from 'src/user/user.schema';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  private normalizeData(data?: Record<string, any>): Record<string, string> {
    const out: Record<string, string> = {};
    if (!data) return out;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined || v === null) {
        out[k] = '';
      } else if (typeof v === 'string') {
        out[k] = v;
      } else if (
        typeof v === 'number' ||
        typeof v === 'boolean' ||
        typeof v === 'bigint'
      ) {
        out[k] = String(v);
      } else {
        try {
          out[k] = JSON.stringify(v);
        } catch (err) {
          out[k] = String(v);
        }
      }
    }
    return out;
  }

  async sendPushNotification(
    receiverIds: string[],
    senderId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    saveToDb: boolean = true,
  ) {
    try {
      const objectIds = receiverIds.map((id) => new Types.ObjectId(id));
      const users = await this.userModel
        .find({ _id: { $in: objectIds } })
        .select('fcmToken');

      const allTokens = users
        .map((user) => user.fcmToken)
        .filter((token) => !!token);

      if (!allTokens.length) {
        console.log('[NotificationService] no tokens to send to');
        return { success: true, message: 'No tokens to send to' };
      }

      const dataPayload = this.normalizeData(data || {});
      dataPayload.senderId = String(senderId);

      console.log('[NotificationService] sending data payload:', dataPayload);
      console.log('[NotificationService] sending to tokens count:', allTokens.length);

      const message: admin.messaging.MulticastMessage = {
        tokens: allTokens,
        data: dataPayload,
        notification: {
          title,
          body,
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
          },
        },
        apns: {
          headers: { 
            'apns-priority': '10' 
          },
          payload: { 
            aps: { 
              'content-available': 1,
              alert: {
                title,
                body,
              }
            } 
          },
        },
      };

      const resp = await admin.messaging().sendEachForMulticast(message);
      
      console.log('[NotificationService] FCM send result:', {
        successCount: resp.successCount,
        failureCount: resp.failureCount,
        responses: resp.responses.map((r, index) => ({
          token: allTokens[index],
          success: r.success,
          error: r.error?.message,
          messageId: r.messageId,
        })),
      });

      if (saveToDb && Types.ObjectId.isValid(senderId)) {
        await this.notificationModel.create({
          receiver: objectIds.map((id) => ({ userId: id, isRead: false })),
          senderId: new Types.ObjectId(senderId),
          title,
          body,
          data,
        });
      } else if (saveToDb) {
        console.log('[NotificationService] Skipping DB save - invalid senderId:', senderId);
      }

      return { success: true, resp };
    } catch (error) {
      console.error('❌ Error sending or saving notification:', error);
      return { success: false, error: error?.message || String(error) };
    }
  }

  async getNotificationsForUser(userId: string, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      const notifications = await this.notificationModel
        .find({ 'receiver.userId': new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('senderId', 'username handleName _id profilePic');

      const total = await this.notificationModel.countDocuments({
        'receiver.userId': new Types.ObjectId(userId),
      });

      const result = (notifications as any[]).map((notification) => {
        const receiverData = notification.receiver.find((r) =>
          r.userId.equals(userId),
        );
        return {
          _id: notification._id,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          createdAt: notification.createdAt,
          isRead: receiverData?.isRead ?? false,
          sender: notification.senderId,
        };
      });

      return {
        data: result,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('❌ Error getting notifications:', error);
      throw error;
    }
  }

  async markNotificationAsRead(userId: string, notificationId: string) {
    try {
      await this.notificationModel.updateOne(
        {
          _id: new Types.ObjectId(notificationId),
          'receiver.userId': new Types.ObjectId(userId),
        },
        {
          $set: { 'receiver.$.isRead': true },
        },
      );
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      throw error;
    }
  }
}

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

  async sendPushNotification(
    receiverIds: string[],
    senderId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    try {
      const objectIds = receiverIds.map((id) => new Types.ObjectId(id));

      const users = await this.userModel
        .find({ _id: { $in: objectIds } })
        .select('fcmToken');

      const allTokens = users
        .map((user) => user.fcmToken)
        .filter((token) => !!token);

      const dataPayload: Record<string, string> = Object.entries(
        data || {},
      ).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'string' ? value : JSON.stringify(value);
        return acc;
      }, {});

      for (const token of allTokens) {
        const message = {
          token,
          notification: { title, body },
          data: dataPayload,
        };
        await admin.messaging().send(message);
      }

      await this.notificationModel.create({
        receiver: objectIds.map((id) => ({ userId: id, isRead: false })),
        senderId: new Types.ObjectId(senderId),
        title,
        body,
        data,
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Error sending or saving notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Lấy danh sách thông báo cho 1 user
  async getNotificationsForUser(userId: string) {
    try {
      const notifications = await this.notificationModel
        .find({ 'receiver.userId': new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .lean();

      // Lấy isRead riêng của user đó
      const result = notifications.map((notification) => {
        const receiverData = notification.receiver.find((r) =>
          r.userId.equals(userId),
        );
        return {
          ...notification,
          isRead: receiverData?.isRead ?? false,
        };
      });

      return result;
    } catch (error) {
      console.error('❌ Error getting notifications:', error);
      throw error;
    }
  }
}

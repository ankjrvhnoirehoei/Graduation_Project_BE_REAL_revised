import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { NotificationGateway } from "./notification.gateway";

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
    private readonly gateway: NotificationGateway,
  ) {}

  // 🔹 Gửi thông báo cho 1 người
  async notify({
    sender,
    receiver,
    type,
    content,
    postId,
  }: {
    sender: string;
    receiver: string;
    type: 'post' | 'like' | 'comment';
    content: string;
    postId: string;
  }) {
    const notification = await this.notificationModel.create({
      sender,
      receiver,
      type,
      content,
      postId,
    });

    this.gateway.sendNotification(receiver, `new_${type}`, {
      id: notification._id.toString(),
      sender,
      receiver,
      content,
      postId,
      type,
    //   createdAt: notification.createdAt,
    });
  }

  // 🔹 Gửi thông báo cho nhiều người
  async notifyMany({
    sender,
    receivers,
    type,
    content,
    postId,
  }: {
    sender: string;
    receivers: string[];
    type: 'post' | 'like' | 'comment';
    content: string;
    postId: string;
  }) {
    const notifications = await this.notificationModel.insertMany(
      receivers.map((receiver) => ({
        sender,
        receiver,
        type,
        content,
        postId,
      }))
    );

    for (let i = 0; i < receivers.length; i++) {
      const receiver = receivers[i];
      const notification = notifications[i];

      this.gateway.sendNotification(receiver, `new_${type}`, {
        id: notification._id.toString(),
        sender,
        receiver,
        content,
        postId,
        type,
        // createdAt: notification.createdAt,
      });
    }
  }

  // 🔹 Lấy thông báo của 1 user
  async getNotificationsByUser(userId: string) {
    return this.notificationModel
      .find({ receiver: userId })
      .sort({ createdAt: -1 })
      .limit(100);
  }

  // 🔹 Đánh dấu đã đọc
  async markAsRead(notificationId: string) {
    return this.notificationModel.findByIdAndUpdate(notificationId, {
      isRead: true,
    });
  }

  // 🔹 Đánh dấu tất cả đã đọc
  async markAllAsRead(userId: string) {
    return this.notificationModel.updateMany(
      { receiver: userId, isRead: false },
      { $set: { isRead: true } }
    );
  }

  // 🔹 Xóa thông báo
  async deleteNotification(notificationId: string) {
    return this.notificationModel.findByIdAndDelete(notificationId);
  }
}

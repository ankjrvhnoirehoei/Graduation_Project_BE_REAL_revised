import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { NotificationGateway } from "../gateway/notification.gateway";
import { Notification, NotificationDocument } from "./notification.schema";
import { User } from "src/user/user.schema";
import { Post } from "src/post/post.schema";


@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly gateway: NotificationGateway,
  ) {}

  // 🔹 Notify a single user
  async notify({
    actor,
    recipient,
    postId,
    type,
    caption,
    image,
    subjects,
  }: {
    actor: string; // userId of the actor
    recipient: string;
    postId?: string,
    type: 'new_post' | 'post_like' | 'comment';
    caption?: string;
    image?: string;
    subjects?: string[];
  }) {
    const notification = await this.notificationModel.create({
      recipient,
      actors: [actor],
      type,
      caption,
      image,
      subjects,
    });

    this.gateway.sendNotification(recipient, `new_${type}`, {
      id: notification._id.toString(),
      recipient,
      actors: [actor],
      type,
      caption,
      image,
      subjects,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    });
  }

  // 🔹 Notify many users
  async notifyMany({
    actor,
    recipients,
    postId,
    type,
    caption,
    image,
    subjects,
  }: {
    actor: string;
    recipients: string[];
    postId?: string;
    type: 'new_post' | 'post_like' | 'comment';
    caption?: string;
    image?: string;
    subjects?: string[];
  }) {
    const notifications = await this.notificationModel.insertMany(
      recipients.map((recipient) => ({
        recipient,
        postId,
        actors: [actor],
        type,
        caption,
        image,
        subjects,
      }))
    );

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const notification = notifications[i];

      this.gateway.sendNotification(recipient, `new_${type}`, {
        id: notification._id.toString(),
        recipient,
        postId,
        actors: [actor],
        type,
        caption,
        image,
        subjects,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      });
    }
  }

  // 🔹 Get notifications for a user
  async getNotificationsByUser(
    userId: string,
    opts?: { unreadOnly?: boolean; limit?: number }
  ) {
    const query: any = { recipient: userId };
    if (opts?.unreadOnly) query.isRead = false;
    const lim = opts?.limit ?? 100;

    // Fetch and populate
    const raw = await this.notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(lim)
      .populate<{ actors: User[] }>('actors', 'username handleName profilePic')
      .populate<{ postId: Post }>('postId', 'caption')
      .lean();

    // Transform into user-friendly DTOs
    return raw.map((n) => {
      if (n.type === 'post_like') {
        const likers = n.actors as unknown as Array<{
          _id: string;
          username: string;
          handleName: string;
          profilePic?: string;
        }>;

        // Pick the first liker
        const [first, ...rest] = likers;
        const count = rest.length;
        const postCaption = n.postId?.caption?.trim();
        // Build caption
        let humanText = `${first.handleName}`;
        if (count > 0) {
          humanText += ` and ${count} other${count > 1 ? 's' : ''}`;
          humanText += ` have liked your `;
        } else {
          humanText += ` has liked your `;
        }
        humanText += postCaption ? `"${postCaption}".` : `post.`;

        return {
          id: n._id.toString(),
          type: n.type,
          isRead: n.isRead,
          createdAt: n.createdAt,
          post: {
            id: (n.postId && (n.postId as any)._id ? (n.postId as any)._id.toString() : null),
            caption: postCaption || null,
          },
          actors: likers.map((u) => ({
            id: u._id.toString(),
            username: u.username,
            handleName: u.handleName,
            profilePic: u.profilePic || null,
          })),
          caption: humanText,
        };
      }

      // Fallback for other types—return raw minimally
      return {
        id: n._id.toString(),
        type: n.type,
        isRead: n.isRead,
        createdAt: n.createdAt,
        caption: n.caption || null,
      };
    });
  }

  // 🔹 Mark as read
  async markAsRead(notificationId: string) {
    return this.notificationModel.findByIdAndUpdate(notificationId, {
      isRead: true,
    });
  }

  // 🔹 Mark all as read
  async markAllAsRead(userId: string) {
    return this.notificationModel.updateMany(
      { recipient: userId, isRead: false },
      { $set: { isRead: true } }
    );
  }

  // 🔹 Delete notification
  async deleteNotification(notificationId: string) {
    return this.notificationModel.findByIdAndDelete(notificationId);
  }
  // notification for liking a post
  async notifyLike(sender: string, postOwner: string, postId: string) {
    const existing = await this.notificationModel.findOne({
      recipient: postOwner,  
      type: 'post_like',
      postId,
      isRead: false,
    });

    if (existing) {
      // append to actors array
      await existing.updateOne({ $addToSet: { actors: sender } });
      // re-emit with full list of actors:
      return this.gateway.sendNotification(
        postOwner,
        'new_post_like',
        {
          id: existing._id.toString(),
          recipient: postOwner,
          actors: existing.actors.concat([new Types.ObjectId(sender)]),
          type: 'post_like',
          postId: existing.postId?.toString(),
          isRead: existing.isRead,
          createdAt: existing.createdAt,
        }
      );
    }

    // first like
    const notif = await this.notificationModel.create({
      recipient: postOwner,     
      actors: [sender],         
      type: 'post_like',
      postId,                   
    });

    return this.gateway.sendNotification(
      postOwner,
      'new_post_like',
      {
        id: notif._id.toString(),
        recipient: postOwner,
        actors: [sender],
        type: 'post_like',
        postId: notif.postId?.toString(),
        isRead: notif.isRead,
        createdAt: notif.createdAt,
      }
    );
  }  

  // in case of retracting like quickly
  async retractLike(sender: string, recipient: string, postId: string) {
    const notif = await this.notificationModel.findOne({
      recipient,
      type: 'post_like',
      postId,
    });
    if (!notif) return;

    // remove the actor
    await notif.updateOne({ $pull: { actors: sender } });

    // re-fetch to see if there are any actors left
    const updated = await this.notificationModel.findById(notif._id);
    if (!updated) return;

    if (updated.actors.length === 0) {
      // if no one left then delete the notification entirely
      await updated.deleteOne();

    } else {
      // still some actors -> emit the new grouped state
      this.gateway.sendNotification(
        recipient,
        'new_post_like', // same event name as on creation
        {
          id: updated._id.toString(),
          recipient,
          actors: updated.actors,
          type: 'post_like',
          postId: updated.postId?.toString(),
          isRead: updated.isRead,
          createdAt: updated.createdAt,
        }
      );
    }
  }
}
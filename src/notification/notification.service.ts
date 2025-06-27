import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { NotificationGateway } from "../gateway/notification.gateway";
import { Notification, NotificationDocument } from "./notification.schema";
import { User, UserDocument } from "src/user/user.schema";
import { Media, MediaDocument } from "src/media/media.schema";

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Media.name)
    private readonly mediaModel: Model<MediaDocument>,
    private readonly gateway: NotificationGateway,
  ) {}

  // 🔹 Unified notify method (replaces both notify and notifyMany)
  async notify({
    actor,
    recipients, // Now always an array
    postId,
    type,
    caption,
    image,
    subjects,
  }: {
    actor: string;
    recipients: string[]; // Changed to array
    postId?: string;
    type: 'new_post' | 'post_like' | 'comment' | 'comment_like' | 'new_story' | 'story_like' | 'follow_request' | 'follow' | 'reply';
    caption?: string;
    image?: string;
    subjects?: string[];
  }) {
    const notification = await this.notificationModel.create({
      recipients, // Now an array
      actors: [actor],
      type,
      caption,
      image,
      subjects,
      postId,
    });

    // Send notification to all recipients
    recipients.forEach(recipient => {
      this.gateway.sendNotification(recipient, `new_${type}`, {
        id: notification._id.toString(),
        recipients,
        actors: [actor],
        type,
        caption,
        image,
        subjects,
        isRead: false, // Individual read status will be handled differently
        createdAt: notification.createdAt,
      });
    });
  }

  // 🔹 Get notifications for a user (updated query)
  async getNotificationsByUser(
    userId: string,
    opts?: { unreadOnly?: boolean; limit?: number },
  ) {
    const query: any = { recipients: userId }; // Changed from recipient to recipients
    
    // For unread notifications, check if user is NOT in readBy array
    if (opts?.unreadOnly) {
      query.readBy = { $ne: userId };
    }
    
    const lim = opts?.limit ?? 100;

    const raw = await this.notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(lim)
      .populate('actors', 'handleName profilePic')
      .lean();

    return raw.map(n => {
      const text = n.caption || 'Thông báo mới';
      const actorsArr = n.actors as unknown as Array<{ handleName: string; profilePic?: string; }>;
      const recent = actorsArr.slice(-2).reverse();
      const extraCount = actorsArr.length > recent.length ? actorsArr.length - recent.length : 0;
      
      // Check if current user has read this notification
      const isRead = (n.readBy as Types.ObjectId[]).some(id => id.toString() === userId);
      
      const base = {
        id: n._id.toString(),
        type: n.type,
        isRead, // Now calculated per user
        createdAt: n.createdAt,
        actors: recent,
        caption: text,
        extraCount,
        postId: n.postId?.toString() || null,
        image: n.image || null,
      };
      return base;
    });
  }

  // 🔹 Mark as read (updated for specific user)
  async markAsRead(notificationId: string, userId: string) {
    return this.notificationModel.findByIdAndUpdate(
      notificationId,
      { $addToSet: { readBy: userId } }, // Add user to readBy array
      { new: true }
    );
  }

  // 🔹 Mark all as read (updated for specific user)
  async markAllAsRead(userId: string) {
    return this.notificationModel.updateMany(
      { 
        recipients: userId, 
        readBy: { $ne: userId } // Only update notifications not already read by this user
      },
      { $addToSet: { readBy: userId } }
    );
  }

  // 🔹 Delete notification (unchanged)
  async deleteNotification(notificationId: string) {
    return this.notificationModel.findByIdAndDelete(notificationId);
  }

  // 🔹 Handle liked-post notifications with captions persisted
  async notifyLike(
    senderId: string,
    recipientId: string, // Still single recipient for like notifications
    postId: string,
  ) {
    const sender = await this.userModel
      .findById(senderId)
      .select('handleName username')
      .lean();
    if (!sender) throw new NotFoundException('Sender not found');
    const actorName = sender.handleName || sender.username;

    // Check for existing unread notification for this specific recipient
    const existing = await this.notificationModel.findOne({
      recipients: recipientId, // Updated field name
      type: 'post_like',
      postId,
      readBy: { $ne: recipientId }, // Not read by this recipient
    });

    if (existing) {
      await existing.updateOne({ $addToSet: { actors: senderId } });
      await existing.populate<{ actors: User[] }>('actors', 'handleName');

      const likers = (existing.actors as any) as User[];
      const [first, ...others] = likers;
      const count = others.length;
      let newCaption = `${first.handleName}`;
      if (count > 0) {
        newCaption += ` và ${count} người khác đã thích bài viết của bạn.`;
      } else {
        newCaption += ` đã thích bài viết của bạn.`;
      }

      await existing.updateOne({ caption: newCaption });

      this.gateway.sendNotification(
        recipientId,
        'new_post_like',
        {
          id: existing._id.toString(),
          recipients: existing.recipients.map(r => r.toString()),
          actors: (likers as Array<User & { _id: Types.ObjectId }>).map((u) => u._id.toString()),
          type: 'post_like',
          postId: existing.postId?.toString(),
          caption: newCaption,
          isRead: false, // Will be calculated in frontend
          createdAt: existing.createdAt,
        },
      );
      return;
    }

    // First like — create new notification
    const initialCaption = `${actorName} đã thích bài viết của bạn.`;
    const notif = await this.notificationModel.create({
      recipients: [recipientId], // Now an array with single recipient
      actors: [senderId],
      type: 'post_like',
      postId,
      caption: initialCaption,
    });

    this.gateway.sendNotification(
      recipientId,
      'new_post_like',
      {
        id: notif._id.toString(),
        recipients: [recipientId],
        actors: [senderId],
        type: 'post_like',
        postId: notif.postId?.toString(),
        caption: initialCaption,
        isRead: false,
        createdAt: notif.createdAt,
      },
    );
  }

  // 🔹 Handle unlikes (updated for array recipients)
  async retractLike(
    senderId: string,
    recipientId: string,
    postId: string,
  ) {
    const notif = await this.notificationModel.findOne({
      recipients: recipientId, // Updated field name
      type: 'post_like',
      postId,
    });
    if (!notif) return;

    await notif.updateOne({ $pull: { actors: senderId } });
    const updated = await this.notificationModel.findById(notif._id);
    if (!updated) return;

    if ((updated.actors || []).length === 0) {
      await updated.deleteOne();
    } else {
      await updated.populate<{ actors: User[] }>('actors', 'handleName');
      const likers = (updated.actors as any) as User[];
      const [first, ...others] = likers;
      const count = others.length;
      let newCaption = `${first.handleName}`;
      if (count > 0) {
        newCaption += ` và ${count} người khác đã thích bài viết của bạn.`;
      } else {
        newCaption += ` đã thích bài viết của bạn.`;
      }
      await updated.updateOne({ caption: newCaption });
    }
  }

  // 🔹 Handle comment notifications (comments on posts)
  async notifyComment(
    commenterId: string,
    postOwnerId: string,
    postId: string,
  ) {
    // fetch commenter
    const commenter = await this.userModel.findById(commenterId).select('handleName username').lean();
    if (!commenter) throw new NotFoundException('Người bình luận không tồn tại');
    const actorName = commenter.handleName || commenter.username;

    // fetch first media of post
    const media = await this.mediaModel
      .findOne({ postID: new Types.ObjectId(postId) })
      .sort({ _id: 1 })
      .lean();
    const mediaUrl = media?.imageUrl || media?.videoUrl || null;

    // check existing unread notification for this post
    const existing = await this.notificationModel.findOne({
      recipients: postOwnerId, // Updated field name
      type: 'comment',
      postId,
      readBy: { $ne: postOwnerId }, // Updated to use readBy instead of isRead
    });

    if (existing) {
      // update actors
      await existing.updateOne({ $addToSet: { actors: commenterId } });
      await existing.populate<{ actors: User[] }>('actors', 'handleName profilePic');
      const commenters = existing.actors as unknown as User[];
      const [first, ...others] = commenters;
      const count = others.length;
      const cap = `${first.handleName}${count > 0 ? ` và ${count} người khác đã bình luận về bài viết của bạn.` : ' đã bình luận về bài viết của bạn.'}`;
      await existing.updateOne({ caption: cap });

      this.gateway.sendNotification(
        postOwnerId,
        'new_comment',
        {
          id: existing._id.toString(),
          recipients: existing.recipients.map(r => r.toString()), // Updated field name
          actors: commenters.slice(-2).map(u => (u as User & { _id: Types.ObjectId })._id.toString()),
          type: 'comment',
          caption: cap,
          image: mediaUrl,
          isRead: false, // Will be calculated in frontend
          createdAt: existing.createdAt,
        }
      );
      return;
    }

    // first comment
    const caption = `${actorName} đã bình luận về bài viết của bạn.`;
    const notif = await this.notificationModel.create({
      recipients: [postOwnerId], // Updated to array
      actors: [commenterId],
      type: 'comment',
      postId,
      caption,
      image: mediaUrl,
    });

    this.gateway.sendNotification(
      postOwnerId,
      'new_comment',
      {
        id: notif._id.toString(),
        recipients: [postOwnerId], // Updated to array
        actors: [commenterId],
        type: 'comment',
        caption,
        image: mediaUrl,
        isRead: false,
        createdAt: notif.createdAt,
      }
    );
  }

  // 🔹 Handle reply to comment notifications (updated for array recipients)
  async notifyReply(
    replierId: string,
    parentCommenterId: string,
    postId: string,
  ) {
    const replier = await this.userModel.findById(replierId).select('handleName username').lean();
    if (!replier) throw new NotFoundException('Người trả lời không tồn tại');
    const actorName = replier.handleName || replier.username;

    // fetch post caption for context
    const postCaption = (await this.notificationModel.db.collection('posts').findOne({ _id: new Types.ObjectId(postId) }, { projection: { caption: 1 } }))?.caption || '';

    // existing batch
    const existing = await this.notificationModel.findOne({
      recipients: parentCommenterId, // Updated field name
      type: 'reply',
      postId,
      readBy: { $ne: parentCommenterId }, // Updated to use readBy instead of isRead
    });
    
    if (existing) {
      await existing.updateOne({ $addToSet: { actors: replierId } });
      await existing.populate<{ actors: User[] }>('actors', 'handleName profilePic');
      const actors = existing.actors as unknown as User[];
      const [first, ...rest] = actors;
      const count = rest.length;
      const cap = `${first.handleName}${count > 0 ? ` và ${count} người khác đã trả lời bình luận của bạn về bài viết "${postCaption}".` : ` đã trả lời bình luận của bạn về bài viết "${postCaption}".`}`;
      await existing.updateOne({ caption: cap });

      this.gateway.sendNotification(
        parentCommenterId,
        'new_reply',
        {
          id: existing._id.toString(),
          recipients: existing.recipients.map(r => r.toString()), // Updated field name
          actors: actors.slice(-2).map(u => (u as User & { _id: Types.ObjectId })._id.toString()),
          type: 'reply',
          caption: cap,
          isRead: false, // Will be calculated in frontend
          createdAt: existing.createdAt,
        }
      );
      return;
    }

    const initialCap = `${actorName} đã trả lời bình luận của bạn về bài viết "${postCaption}".`;
    const notif = await this.notificationModel.create({
      recipients: [parentCommenterId], // Updated to array
      actors: [replierId],
      type: 'reply',
      postId,
      caption: initialCap,
    });

    this.gateway.sendNotification(
      parentCommenterId,
      'new_reply',
      {
        id: notif._id.toString(),
        recipients: [parentCommenterId], // Updated to array
        actors: [replierId],
        type: 'reply',
        caption: initialCap,
        isRead: false,
        createdAt: notif.createdAt,
      }
    );
  }

  // 🔹 Notify like on comment
  async notifyCommentLike(
    likerId: string,
    commentOwnerId: string,
    postId: string,
    commentId: string,
  ) {
    if (likerId === commentOwnerId) return;
    const user = await this.userModel.findById(likerId).select('handleName').lean();
    if (!user) throw new NotFoundException('User not found');
    const name = user.handleName;

    // find existing notification irrespective of read status
    const existing = await this.notificationModel.findOne({
      recipients: commentOwnerId, // Changed from recipient to recipients
      type: 'comment_like',
      postId,
      subjects: commentId,
    });

    if (existing) {
      // add to actors if not present
      await existing.updateOne({ $addToSet: { actors: likerId } });
      await existing.populate('actors', 'handleName profilePic');
      const actors = existing.actors as unknown as User[];
      const [first, ...others] = actors;
      const count = actors.length - 1;
      const caption = `${first.handleName}${count > 0 ? ` và ${count} người khác đã thích bình luận của bạn.` : ' đã thích bình luận của bạn.'}`;
      await existing.updateOne({ 
        caption,
        $pull: { readBy: commentOwnerId } // Remove from readBy to mark as unread again
      });

      // re-emit grouped update
      this.gateway.sendNotification(commentOwnerId, 'new_comment_like', {
        id: existing._id.toString(),
        recipients: [commentOwnerId], // Changed from recipient to recipients array
        actors: (actors.slice(-2) as Array<User & { _id: Types.ObjectId }>).map(u => u._id.toString()),
        type: 'comment_like',
        caption,
        isRead: false, // Mark as unread since there's new activity
        createdAt: existing.createdAt,
      });
      return;
    }

    // first like
    const caption = `${name} đã thích bình luận của bạn.`;
    const notif = await this.notificationModel.create({
      recipients: [commentOwnerId], // Changed from recipient to recipients array
      actors: [likerId],
      type: 'comment_like',
      postId,
      subjects: [commentId],
      caption,
      readBy: [], // Initialize as empty array (unread)
    });

    this.gateway.sendNotification(commentOwnerId, 'new_comment_like', {
      id: notif._id.toString(),
      recipients: [commentOwnerId], // Changed from recipient to recipients array
      actors: [likerId],
      type: 'comment_like',
      caption,
      isRead: false, // New notification is unread
      createdAt: notif.createdAt,
    });
  }

  // 🔹 Retract a comment-like
  async retractCommentLike(
    likerId: string,
    commentOwnerId: string,
    postId: string,
    commentId: string,
  ) {
    const existing = await this.notificationModel.findOne({
      recipients: commentOwnerId, // Changed from recipient to recipients
      type: 'comment_like',
      postId,
      subjects: commentId,
    });
    if (!existing) return;

    // remove actor
    await existing.updateOne({ $pull: { actors: likerId } });
    const updated = await this.notificationModel.findById(existing._id).populate('actors', 'handleName profilePic');
    if (!updated) return;

    if ((updated.actors as unknown as User[]).length === 0) {
      // remove notification entirely
      await updated.deleteOne();
    } else {
      // update caption and re-save
      const actors = updated.actors as unknown as User[];
      const [first, ...others] = actors;
      const count = others.length;
      const caption = `${first.handleName}${count > 0 ? ` và ${count} người khác đã thích bình luận của bạn.` : ' đã thích bình luận của bạn.'}`;
      
      // Check if the notification owner has read this notification
      const isRead = (updated.readBy as Types.ObjectId[]).some(id => id.toString() === commentOwnerId);
      
      await updated.updateOne({ caption });
      
      // emit updated grouping
      this.gateway.sendNotification(commentOwnerId, 'new_comment_like', {
        id: updated._id.toString(),
        recipients: [commentOwnerId], // Changed from recipient to recipients array
        actors: actors.slice(-2).map(u => (u as User & { _id: Types.ObjectId })._id.toString()),
        type: 'comment_like',
        caption,
        isRead, // Use calculated read status
        createdAt: updated.createdAt,
      });
    }
  }
}

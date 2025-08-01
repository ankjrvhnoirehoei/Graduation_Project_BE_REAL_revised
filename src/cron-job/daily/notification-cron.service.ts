import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../../src/user/user.schema';
import admin from '../../../src/firebase';

@Injectable()
export class NotificationCronService {
  private readonly logger = new Logger(NotificationCronService.name);

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  // 🚨 Sáng mỗi ngày
  @Cron('0 9 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleMorningNotification() {
    this.logger.log('☀️ Cron 9h sáng bắt đầu...');
    await this.sendNotification(
      '☀️ Chào buổi sáng!',
      'Chúc bạn có một buổi sáng tốt lành và đừng quên vào Cirla để theo dõi những video thú vị nhé!',
    );
  }

  // 🌙 Tối mỗi ngày
  @Cron('0 23 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleEveningNotification() {
    this.logger.log('🌙 Cron tối bắt đầu...');
    await this.sendNotification(
      '🌙 Kết thúc một ngày!',
      'Hôm nay của bạn thế nào? Cirla lun mong muốn những điều tốt đẹp nhất đến với bạn, ngủ ngon nhé!',
    );
  }

  private async sendNotification(title: string, body: string) {
    const users = await this.userModel
      .find({
        fcmToken: { $exists: true, $ne: null },
        wantNotified: true,
        deletedAt: false,
      })
      .select('fcmToken');

    const tokens = users.map((u) => u.fcmToken).filter(Boolean);

    if (tokens.length === 0) {
      this.logger.warn('❗Không có người dùng nào có fcmToken.');
      return;
    }

    const message = {
      tokens,
      notification: { title, body },
    };

    try {
      const res = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(`✅ Đã gửi ${res.successCount} thông báo: "${title}"`);
      if (res.failureCount > 0) {
        this.logger.warn(`⚠️ ${res.failureCount} token lỗi.`);
        res.responses.forEach((resp, idx) => {
          if (!resp.success) {
            this.logger.warn(
              `❌ Token lỗi: ${tokens[idx]} - ${resp.error?.message}`,
            );
          }
        });
      }
    } catch (error) {
      this.logger.error('❌ Lỗi gửi FCM:', error);
    }
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ChatBox, ChatBoxDocument } from './chat-box.schema';
import { Model, Types } from 'mongoose';

@Injectable()
export class ChatBoxService {
  constructor(
    @InjectModel(ChatBox.name)
    private readonly chatBoxModel: Model<ChatBoxDocument>,
  ) {}

  async saveChat(
    userId: string,
    prompt: string,
    answer: string,
  ): Promise<ChatBox> {
    return this.chatBoxModel.create({
      userId: new Types.ObjectId(userId),
      prompt,
      answer,
    });
  }

  async getHistory(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const objectUserId = new Types.ObjectId(userId);

    const [data, totalCount] = await Promise.all([
      this.chatBoxModel
        .find({ userId: objectUserId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.chatBoxModel.countDocuments({ userId: objectUserId }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const currentPage = page;

    return {
      currentPage,
      totalPages,
      totalCount,
      limit,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
      data,
    };
  }
}

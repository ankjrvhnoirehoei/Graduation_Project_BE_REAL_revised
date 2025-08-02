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

  async getHistory(userId: string, page = 1, limit = 10): Promise<ChatBox[]> {
    const skip = (page - 1) * limit;
    return this.chatBoxModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }
}

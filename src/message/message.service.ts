import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateMessageDto } from './dto/message.dto';
import { Message } from './message.schema';

interface LeanMessageWithSender {
  _id: string;
  roomId: string;
  content: string;
  media: string;
  createdAt: Date;
  senderId: {
    _id: string;
    handleName: string;
    profilePic?: string;
  };
  reactions?: {
    userId: string;
    content: string;
    createdAt: string;
  }[];
}

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<Message>,
  ) {}

  async create(
    createMessageDto: CreateMessageDto & { senderId: string },
  ): Promise<any> {
    const newMessage = new this.messageModel({
      roomId: createMessageDto.roomId,
      content: createMessageDto.content || '',
      media: createMessageDto.media || null,
      senderId: createMessageDto.senderId,
    });

    const saved = await newMessage.save();

    return saved.populate({
      path: 'senderId',
      select: 'handleName profilePic',
    });
  }

  async findByRoom(roomId: string): Promise<Message[]> {
    return this.messageModel.find({ roomId }).sort({ createdAt: 1 }).exec();
  }

  async getRecentMessages(roomId: string, limit: number = 20): Promise<any[]> {
    const messages = await this.messageModel
      .find({ roomId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({
        path: 'senderId',
        select: 'handleName profilePic',
      })
      .lean<LeanMessageWithSender[]>();

    return messages.reverse().map((msg) => ({
      _id: msg._id,
      roomId: msg.roomId,
      content: msg.content,
      media: msg.media,
      createdAt: msg.createdAt,
      sender: {
        userId: msg.senderId._id,
        handleName: msg.senderId.handleName,
        profilePic: msg.senderId.profilePic,
      },
      reaction: msg.reactions ?? [],
    }));
  }

  async deleteMessagesByRoom(
    roomId: string,
  ): Promise<{ deletedCount: number }> {
    const result = await this.messageModel.deleteMany({ roomId }).exec();
    return { deletedCount: result.deletedCount || 0 };
  }

  async deleteMessageById(
    messageId: string,
    userId: string,
  ): Promise<{ deleted: boolean }> {
    const result = await this.messageModel
      .deleteOne({ _id: messageId, senderId: userId })
      .exec();
    return { deleted: result.deletedCount === 1 };
  }

  async addOrUpdateReaction(
    messageId: string,
    userId: string,
    content: string,
  ) {
    const message = await this.messageModel.findById(messageId);

    if (!message) throw new Error('Message not found');

    message.reactions = message.reactions.filter(
      (r) => r.userId.toString() !== userId,
    );

    message.reactions.push({
      userId: new Types.ObjectId(userId),
      content,
    } as any);

    await message.save();

    return message.populate({
      path: 'senderId',
      select: 'handleName profilePic',
    });
  }
}

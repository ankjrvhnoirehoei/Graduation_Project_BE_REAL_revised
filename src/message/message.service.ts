import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
    }));
  }
}

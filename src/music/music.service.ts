import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MusicDto } from './dto/music.dto';
import { Music } from './music.schema';

@Injectable()
export class MusicService {
  constructor(
    @InjectModel(Music.name) private readonly musicModel: Model<Music>,
  ) {}

  async create(musicDto: MusicDto): Promise<Music> {
    const created = new this.musicModel(musicDto);
    return created.save();
  }

  async findAll(): Promise<Music[]> {
    return this.musicModel.find().exec();
  }

  async findByPost(postID: string): Promise<Music[]> {
    return this.musicModel.find({ postID }).exec();
  }
}
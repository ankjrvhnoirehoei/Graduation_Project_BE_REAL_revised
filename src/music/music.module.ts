import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Music, MusicSchema } from './music.schema';
import { MusicService } from './music.service';
import { MusicController } from './music.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Music.name, schema: MusicSchema }])],
  providers: [MusicService],
  controllers: [MusicController],
  exports: [
    MusicService,
    MongooseModule.forFeature([{ name: Music.name, schema: MusicSchema }]), // Export the model
  ],
})
export class MusicModule {}
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Media, MediaSchema } from './media.schema';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Media.name, schema: MediaSchema }])],
  providers: [MediaService],
  controllers: [MediaController],
  exports: [MediaService],
})
export class MediaModule {}
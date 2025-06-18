import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { Media, MediaSchema } from './media.schema';

@Module({
  imports: [
    DatabaseModule.forFeature([{ name: Media.name, schema: MediaSchema }]),
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [
    MediaService,
    DatabaseModule.forFeature([{ name: Media.name, schema: MediaSchema }]), // Export the model
  ],
})
export class MediaModule {}
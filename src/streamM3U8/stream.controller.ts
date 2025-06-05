import { Controller, Get } from '@nestjs/common';
import { StreamService } from './stream.service';

@Controller('stream')
export class StreamController {
  constructor(private readonly streamService: StreamService) {}

  @Get('upload-url')
  async getUploadUrl() {
    const uploadURL = await this.streamService.createDirectUploadUrl();
    return { uploadURL };
  }
}
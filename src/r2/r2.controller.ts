import { Controller, Get, Query } from '@nestjs/common';
import { generatePresignedUrl } from './r2.service';

@Controller('r2')
export class R2UploadController {
  @Get('presigned-url')
  async getPresignedUrl(@Query('fileName') fileName: string, @Query('contentType') contentType?: string) {
    if (!fileName) {
      throw new Error('Missing fileName');
    }

    const url = await generatePresignedUrl(fileName, contentType || 'image/jpeg');
    return {
      url,
      fileName,
      contentType: contentType || 'image/jpeg',
    };
  }
}
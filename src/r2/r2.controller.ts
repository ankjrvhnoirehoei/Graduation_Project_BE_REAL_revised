import {
  Body,
  Controller,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
import { generatePresignedUrl, generatePresignedVideoUrl } from './r2.service';

@Controller('r2')
export class R2UploadController {
  @Post('presigned-url')
  async getPresignedUrl(
    @Body() body: { fileName: string; contentType?: string },
  ) {
    const { fileName, contentType } = body;

    if (!fileName) {
      throw new Error('Missing fileName');
    }

    try {
      const url = await generatePresignedUrl(
        fileName,
        contentType || 'image/jpeg',
      );

      return {
        url,
        fileName,
        contentType: contentType || 'image/jpeg',
      };
    } catch (error) {
      console.error('❌ Failed to generate presigned URL:', error);
      throw new InternalServerErrorException(
        'Could not generate presigned URL',
      );
    }
  }

  @Post('presigned-video-url')
  async getPresignedVideoUrl(
    @Body() body: { fileName: string; contentType?: string },
  ) {
    const { fileName, contentType } = body;
    if (!fileName) {
      throw new InternalServerErrorException('Missing fileName');
    }
    try {
      const url = await generatePresignedVideoUrl(
        fileName,
        contentType || 'video/mp4',
      );
      return {
        url,
        fileName,
        contentType: contentType || 'video/mp4',
      };
    } catch (error) {
      console.error('❌ Failed to generate presigned video URL:', error);
      throw new InternalServerErrorException(
        'Could not generate presigned video URL',
      );
    }
  }
}

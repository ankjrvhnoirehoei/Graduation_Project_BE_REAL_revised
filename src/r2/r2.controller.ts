import {
  Body,
  Controller,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
import { generatePresignedUrl } from './r2.service';

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
}

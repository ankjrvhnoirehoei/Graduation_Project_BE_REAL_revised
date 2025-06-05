import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class StreamService {
  private ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  private API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

  async createDirectUploadUrl(): Promise<{ uploadURL: string; key: string }> {
    try {
      const response = await axios.post(
        `https://api.cloudflare.com/client/v4/accounts/${this.ACCOUNT_ID}/stream/direct_upload`,
        {
          maxDurationSeconds: 3600,
          requireSignedURLs: false,
        },
        {
          headers: {
            Authorization: `Bearer ${this.API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.success) {
        const { uploadURL, id } = response.data.result;
        return {
          uploadURL,
          key: id,
        };
      } else {
        throw new InternalServerErrorException('Failed to get upload URL');
      }
    } catch (error) {
      console.error(
        'Error creating direct upload URL:',
        error.response?.data || error.message,
      );
      throw new InternalServerErrorException(
        error.response?.data || 'Internal server error',
      );
    }
  }
}

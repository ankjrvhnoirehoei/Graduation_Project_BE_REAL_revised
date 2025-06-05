import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class StreamService {
  private ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  private API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

  async createDirectUploadUrl(): Promise<string> {
    try {
      const response = await axios.post(
        `https://api.cloudflare.com/client/v4/accounts/${this.ACCOUNT_ID}/stream/direct_upload`,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.API_TOKEN}`,
          },
        },
      );

      if (response.data.success) {
        return response.data.result.uploadURL;
      } else {
        throw new InternalServerErrorException('Failed to get upload URL');
      }
    } catch (error) {
      console.error(
        'Error creating direct upload URL:',
        error.response?.data || error.message,
      );
      throw new InternalServerErrorException('Internal server error');
    }
  }
}

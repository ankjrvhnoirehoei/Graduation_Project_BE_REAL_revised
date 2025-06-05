import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class StreamService {
  private ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  private API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

  async createDirectUploadUrl(): Promise<string> {
    const response = await axios.post(
      `https://api.cloudflare.com/client/v4/accounts/${this.ACCOUNT_ID}/stream/direct_upload`,
      {},
      {
        headers: {
          Authorization: `Bearer ${this.API_TOKEN}`,
        },
      },
    );

    return response.data.result.uploadURL;
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Mux from '@mux/mux-node';

@Injectable()
export class MuxService {
  private video: Mux.Video;

  constructor(private configService: ConfigService) {
    const mux = new Mux({
      tokenId: configService.get<string>('MUX_TOKEN_ID'),
      tokenSecret: configService.get<string>('MUX_TOKEN_SECRET'),
    });

    this.video = mux.video;
  }

  async uploadVideo(url: string) {
    const asset = await this.video.assets.create({
      inputs: [{ url }],
      playback_policy: ['public'],
    });

    let status = 'preparing';
    while (status !== 'ready') {
      const assetInfo = await this.video.assets.retrieve(asset.id);
      status = assetInfo.status;
      if (status === 'errored') throw new Error('Mux failed to process video.');
      await new Promise((res) => setTimeout(res, 3000));
    }

    const finalAsset = await this.video.assets.retrieve(asset.id);
    const playbackId = finalAsset.playback_ids?.[0]?.id;
    if (!playbackId) throw new Error('Playback ID not found');

    return {
      id: finalAsset.id,
      playbackId,
      m3u8Url: `https://stream.mux.com/${playbackId}.m3u8`,
    };
  }
}

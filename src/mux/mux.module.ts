import { Module } from '@nestjs/common';
import { MuxService } from './mux.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [MuxService],
  exports: [MuxService],
})
export class MuxModule {}

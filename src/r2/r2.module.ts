import { Module } from '@nestjs/common';
import { R2UploadController } from './r2.controller';

@Module({
  controllers: [R2UploadController],
})
export class R2UploadModule {}
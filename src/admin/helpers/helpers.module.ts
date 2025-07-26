import { Module } from '@nestjs/common';
import { CommonServices } from './helpers.service';

@Module({
  providers: [CommonServices],
  exports: [CommonServices],
})
export class CommonUtilsModule {}
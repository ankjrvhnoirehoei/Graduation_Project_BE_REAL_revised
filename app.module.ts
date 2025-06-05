import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Tự động load .env toàn app
    }),
    ...
  ],
})
export class AppModule {}

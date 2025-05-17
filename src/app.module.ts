import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost/nest'),
    // 1. Load .env into process.env
    ConfigModule.forRoot({
      isGlobal: true,          // makes ConfigService available everywhere
      envFilePath: '.env',     // relative to project root
    }),
    // 3. Register feature modules that define schemas/controllers/providers
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
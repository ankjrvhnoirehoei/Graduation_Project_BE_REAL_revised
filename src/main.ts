import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { SwaggerConfig } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://[::1]:4001',
    ],
    credentials: true,
  });
  app.use(cookieParser());
  SwaggerConfig(app);
  const configService = app.get(ConfigService);
  const port = configService.get('PORT', 3000);
  await app.listen(port);
  console.log(`>>>Application is running on: ${await app.getUrl()}`);
}
bootstrap();

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export const SwaggerConfig = (app: INestApplication): void => {
  const config = new DocumentBuilder()
    .setTitle(`Cirla's Documentation`)
    .setDescription(`API documentation for Cirla Application`)
    .setVersion('1.0')
    .addServer('http://cirla.io.vn')
    .addBearerAuth({
      type: 'http',
      scheme: 'Bearer',
      bearerFormat: 'JWT',
    },
    'refresh-token')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('doc', app, document);
};

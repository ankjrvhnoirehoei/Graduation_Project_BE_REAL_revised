import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { StorySchema } from './schema/story-schema.swagger';

export const SwaggerConfig = (app: INestApplication): void => {
  const config = new DocumentBuilder()
    .setTitle(`Cirla's Documentation`)
    .setDescription(`API documentation for Cirla Application`)
    .setVersion('1.0')
    .addServer('http://cirla.io.vn')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'Bearer',
        bearerFormat: 'JWT',
      },
      'refresh-token'
    )
    .addTag('stories', 'Operations related to stories and highlights')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [StorySchema],
    ignoreGlobalPrefix: false,
  });

  SwaggerModule.setup('doc', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
};
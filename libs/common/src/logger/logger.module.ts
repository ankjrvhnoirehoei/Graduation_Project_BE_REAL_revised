import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { LoggingInterceptor } from './logging.interceptor';

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
        level: process.env.LOG_LEVEL || 'info',
        // add request correlation ID
        genReqId: (req) => req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
    }),
  ],
  providers: [LoggingInterceptor],
  exports: [LoggingInterceptor, PinoLoggerModule],
})
export class LoggerModule {}
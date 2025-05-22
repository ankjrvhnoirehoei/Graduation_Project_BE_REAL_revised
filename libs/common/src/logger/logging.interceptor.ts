import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext('LoggingInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    
    const { method, url, body, query, params, headers, cookies } = request;
    const userAgent = headers['user-agent'] || '';
    const ip = request.ip || request.socket.remoteAddress;
    const userId = (request as any).user?.userId || (request as any).user?.sub;
    
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    (request as any).requestId = requestId;
    
    // log incoming request with Pino's structured logging
    this.logger.info({
      type: 'REQUEST',
      requestId,
      method,
      url,
      body: this.sanitizeBody(body),
      query,
      params,  
      cookies: this.sanitizeCookies(cookies),
      userAgent,
      ip,
      userId,
      timestamp: new Date().toISOString(),
    }, `${method} ${url} - Request received`);

    return next.handle().pipe(
      tap((responseBody) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // successful response
        this.logger.info({
          type: 'RESPONSE',
          requestId,
          method,
          url,
          statusCode: response.statusCode,
          responseBody: this.sanitizeResponse(responseBody),
          duration,
          userId,
          timestamp: new Date().toISOString(),
        }, `${method} ${url} - ${response.statusCode} - ${duration}ms`);
      }),
      catchError((error) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // error response
        this.logger.error({
          type: 'ERROR',
          requestId,
          method,
          url,
          statusCode: error.status || 500,
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          duration,
          userId,
          timestamp: new Date().toISOString(),
        }, `${method} ${url} - ERROR: ${error.message}`);
        
        throw error;
      }),
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    const sanitized = { ...body };
    const sensitiveFields = [
      'password', 
      'confirmPassword', 
      'currentPassword',
      'newPassword',
      'token',
      'refreshToken',
      'accessToken',
      'authorization'
    ];
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  private sanitizeCookies(cookies: any): any {
    if (!cookies) return cookies;
    
    const sanitized = { ...cookies };
    // indicate presence of auth cookies
    const authCookies = ['Authentication', 'Refresh', 'access_token', 'refresh_token'];
    
    Object.keys(sanitized).forEach(key => {
      if (authCookies.includes(key)) {
        sanitized[key] = '[PRESENT]';
      } else {
        sanitized[key] = sanitized[key]; 
      }
    });
    
    return sanitized;
  }

  private sanitizeResponse(response: any): any {
    if (!response) return response;
    
    if (typeof response === 'object') {
      const sanitized = { ...response };
      const sensitiveFields = ['password', 'refreshToken', 'accessToken', 'token'];
      
      sensitiveFields.forEach(field => {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      });
      
      return sanitized;
    }
    
    return response;
  }
} 
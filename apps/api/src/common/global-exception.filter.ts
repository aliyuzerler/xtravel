import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { toErrorBody } from './errors';

/**
 * Tüm exception'ları yakalayan global filtre.
 * Tüm yanıtları A7'nin belirlediği { success: false, message, statusCode, errors? } formatına getirir.
 *
 * Not: NestJS ThrottlerException da HttpException extend ettiği için otomatik olarak
 * burada ele alınır ve 429 Too Many Requests olarak döner.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = toErrorBody(exception);

    // 4xx ve 5xx seviyesindeki hataları logla
    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${body.statusCode} ${body.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (body.statusCode !== 404) {
      this.logger.warn(
        `${request.method} ${request.url} → ${body.statusCode} ${body.message}`,
      );
    }

    response.status(body.statusCode).json(body);
  }
}

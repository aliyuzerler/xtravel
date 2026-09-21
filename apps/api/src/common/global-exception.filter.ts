import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { toErrorBody } from './errors';
import { captureException, captureMessage } from '../lib/sentry';

/**
 * Tüm exception'ları yakalayan global filtre.
 * Tüm yanıtları A7'nin belirlediği { success: false, message, statusCode, errors? } formatına getirir.
 *
 * Sentry entegrasyonu (Faz-8):
 *   - 500 hataları → captureException (Sentry'ye gönder)
 *   - Webhook imza hatası → captureMessage (error level, kritik)
 *   - Önemli 4xx hataları → captureMessage (warning level)
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = toErrorBody(exception);

    // Sentry'ye gönder
    if (body.statusCode >= 500) {
      captureException(
        exception instanceof Error ? exception : new Error(body.message),
        {
          tags: {
            feature: 'api',
            status: String(body.statusCode),
            path: request.path,
            method: request.method,
          },
          extra: {
            body: request.body,
            query: request.query,
            params: request.params,
            code: body.code,
          },
        },
      );
    } else if (
      body.statusCode === 401 &&
      body.code === 'AUTH_TOKEN_INVALID' &&
      request.path.includes('webhook')
    ) {
      // Webhook imza hatası — güvenlik kritik
      captureMessage('Webhook signature mismatch', 'error', {
        tags: { feature: 'webhook', security: 'signature' },
        extra: { path: request.path },
      });
    } else if (body.statusCode === 403 && body.code === 'OWNERSHIP_VIOLATION') {
      // IDOR denemesi — şüpheli
      captureMessage('Ownership violation attempt', 'warning', {
        tags: { feature: 'security', type: 'idor' },
        extra: { path: request.path, method: request.method },
      });
    }

    // Log
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

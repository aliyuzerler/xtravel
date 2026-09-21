import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Tüm HTTP isteklerini loglar.
 * Format: METHOD /path → STATUS durationms (user-agent)
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      const ua = req.get('user-agent') || '-';
      const msg = `${method} ${originalUrl} → ${statusCode} ${duration}ms`;
      if (statusCode >= 500) this.logger.error(msg);
      else if (statusCode >= 400) this.logger.warn(msg);
      else this.logger.log(msg);
    });

    next();
  }
}

import {
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ERROR_CODES } from '@turizm-pazaryeri/shared';

/**
 * Standart hata yanıtı oluşturur (A7 formatı).
 * { success: false, message, statusCode, errors? }
 */
export interface ErrorBody {
  success: false;
  message: string;
  statusCode: number;
  errors?: Array<{ field?: string; message: string; code?: string }>;
  code?: string;
}

export interface AppErrorOptions {
  statusCode?: number;
  code?: string;
  errors?: Array<{ field?: string; message: string; code?: string }>;
  cause?: unknown;
}

/**
 * Tüm uygulama hataları için temel sınıf.
 * HttpException'i extend etmediğimiz için GlobalExceptionFilter'da manuel ele alınır.
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  errors?: Array<{ field?: string; message: string; code?: string }>;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = options.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
    this.code = options.code ?? ERROR_CODES.INTERNAL_ERROR;
    this.errors = options.errors;
    if (options.cause) (this as any).cause = options.cause;
  }

  toHttpBody(): ErrorBody {
    return {
      success: false,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      errors: this.errors,
    };
  }
}

export class ValidationError extends AppError {
  constructor(errors: Array<{ field?: string; message: string; code?: string }>) {
    super('Doğrulama hatası', {
      statusCode: HttpStatus.BAD_REQUEST,
      code: ERROR_CODES.VALIDATION_FAILED,
      errors,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} bulunamadı`, {
      statusCode: HttpStatus.NOT_FOUND,
      code: ERROR_CODES.RESOURCE_NOT_FOUND,
    });
  }
}

export class AuthError extends AppError {
  constructor(message: string, code: string = ERROR_CODES.AUTH_INVALID_CREDENTIALS) {
    super(message, { statusCode: HttpStatus.UNAUTHORIZED, code });
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string, code: string = ERROR_CODES.ROLE_FORBIDDEN) {
    super(message, { statusCode: HttpStatus.FORBIDDEN, code });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: string = ERROR_CODES.RESOURCE_ALREADY_EXISTS) {
    super(message, { statusCode: HttpStatus.CONFLICT, code });
  }
}

export class BusinessError extends AppError {
  constructor(message: string, code: string, statusCode: number = HttpStatus.UNPROCESSABLE_ENTITY) {
    super(message, { statusCode, code });
  }
}

export class ThrottlerError extends AppError {
  constructor(message: string = 'Çok fazla istek') {
    super(message, { statusCode: HttpStatus.TOO_MANY_REQUESTS, code: 'RATE_LIMIT_EXCEEDED' });
  }
}

/**
 * Bir hatayı ErrorBody'ye çevirir.
 * - AppError ise direkt toHttpBody kullanır
 * - HttpException ise NestJS formatından dönüştürür
 * - Bilinmeyen hata için generic 500 döner (detay loglanır)
 */
export function toErrorBody(error: unknown): ErrorBody {
  const logger = new Logger('ErrorHandler');

  if (error instanceof AppError) {
    return error.toHttpBody();
  }

  if (error instanceof HttpException) {
    const status = error.getStatus();
    const response = error.getResponse();
    let message = error.message;
    let errors: ErrorBody['errors'];
    if (typeof response === 'object' && response !== null) {
      const r = response as any;
      if (typeof r.message === 'string') message = r.message;
      if (Array.isArray(r.message)) {
        errors = r.message.map((m: string) => ({ message: m }));
        message = 'Doğrulama hatası';
      }
    }
    return {
      success: false,
      message,
      statusCode: status,
      errors,
    };
  }

  // Beklenmeyen hata
  logger.error(
    `Beklenmeyen hata: ${error instanceof Error ? error.message : String(error)}`,
    error instanceof Error ? error.stack : undefined,
  );
  return {
    success: false,
    message: 'Sunucu hatası',
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ERROR_CODES.INTERNAL_ERROR,
  };
}

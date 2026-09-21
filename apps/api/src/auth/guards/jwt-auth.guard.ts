import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT access token doğrulayan guard.
 * Authorization: Bearer <token> header'ını kontrol eder.
 * Geçersiz/eksikse 401 döner.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

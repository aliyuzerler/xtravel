import { Injectable, Logger } from '@nestjs/common';
import { nanoid } from 'nanoid';

/**
 * Refresh token storage.
 *
 * Faz-1 kararı: In-memory store kullanıldı (process restart'ta tüm refresh
 * token'lar geçersiz olur — geliştirme için kabul edilebilir).
 *
 * Üretim alternatifleri (Faz 5):
 *   - Redis (ör. @nestjs/cache-manager + ioredis)
 *   - Veritabanı tablosu (RefreshToken modeli)
 *
 * Rotasyon mekanizması:
 *   - Her refresh token bir "tokenFamily" (aile) kimliğine bağlı.
 *   - Bir ailedeki ilk token "root" sayılır.
 *   - Refresh sırasında: eski token revoke edilir, aynı aileye yeni token verilir.
 *   - Eğer revoke edilmiş bir token tekrar kullanılırsa → ailedeki tüm token'lar
 *     revoke edilir (olası token çalınması senaryosu).
 */

interface StoredToken {
  token: string;
  userId: string;
  family: string;
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
}

@Injectable()
export class RefreshTokenStore {
  private readonly logger = new Logger(RefreshTokenStore.name);
  private readonly tokens = new Map<string, StoredToken>();

  /**
   * Yeni bir refresh token üretir ve saklar. Aile kimliği döner.
   */
  issue(userId: string, ttlSeconds: number): { token: string; family: string } {
    const token = nanoid(48);
    const family = nanoid(16);
    const now = Date.now();
    const stored: StoredToken = {
      token,
      userId,
      family,
      issuedAt: now,
      expiresAt: now + ttlSeconds * 1000,
      revoked: false,
    };
    this.tokens.set(token, stored);
    return { token, family };
  }

  /**
   * Var olan bir aileye yeni bir refresh token üretir (rotasyon).
   * Eski token revoke edilir, aynı family'e yeni token eklenir.
   */
  issueWithFamily(userId: string, ttlSeconds: number, family: string): { token: string; family: string } {
    const token = nanoid(48);
    const now = Date.now();
    const stored: StoredToken = {
      token,
      userId,
      family,
      issuedAt: now,
      expiresAt: now + ttlSeconds * 1000,
      revoked: false,
    };
    this.tokens.set(token, stored);
    return { token, family };
  }

  /**
   * Token'ı doğrula. Geçerliyse store'dan silinir (rotasyon) ve userId + family döner.
   * - Süresi dolmuşsa → AUTH_TOKEN_EXPIRED
   * - Revoked edilmişse → tüm aile revoke edilir (token çalınması) → AUTH_TOKEN_INVALID
   * - Bulunamadıysa → AUTH_TOKEN_INVALID
   */
  verify(token: string): { userId: string; family: string } {
    const stored = this.tokens.get(token);
    if (!stored) {
      // Olası çalınma: bilinen ama silinmiş bir token tekrar kullanılmış olabilir.
      // Token bulunamadığı için aile tespit edilemiyor; reject.
      throw new TokenError('Geçersiz refresh token', 'AUTH_TOKEN_INVALID');
    }

    if (Date.now() > stored.expiresAt) {
      this.tokens.delete(token);
      throw new TokenError('Süresi dolmuş refresh token', 'AUTH_TOKEN_EXPIRED');
    }

    if (stored.revoked) {
      // Token çalınmış olabilir — ailedeki tüm token'ları revoke et
      this.revokeFamily(stored.family);
      this.logger.warn(
        `Revoked refresh token re-used — revoked entire family ${stored.family} for user ${stored.userId}`,
      );
      throw new TokenError('Geçersiz refresh token (aile iptal edildi)', 'AUTH_TOKEN_INVALID');
    }

    // Geçerli — token'ı revoke et (rotasyon)
    stored.revoked = true;
    return { userId: stored.userId, family: stored.family };
  }

  /**
   * Bir kullanıcıya ait tüm refresh token'ları revoke eder (logout).
   */
  revokeAllForUser(userId: string): number {
    let count = 0;
    for (const [, stored] of this.tokens) {
      if (stored.userId === userId && !stored.revoked) {
        stored.revoked = true;
        count++;
      }
    }
    return count;
  }

  /**
   * Ailedeki tüm token'ları revoke eder.
   */
  private revokeFamily(family: string): void {
    for (const [, stored] of this.tokens) {
      if (stored.family === family) {
        stored.revoked = true;
      }
    }
  }

  /**
   * Test/diagnostic amaçlı: toplam aktif token sayısı.
   */
  size(): number {
    let n = 0;
    for (const [, s] of this.tokens) if (!s.revoked) n++;
    return n;
  }
}

export class TokenError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TokenError';
  }
}

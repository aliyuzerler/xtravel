import { Injectable, Logger } from '@nestjs/common';
import { nanoid } from 'nanoid';

/**
 * Tek kullanımlık şifre sıfırlama token'ları için in-memory store.
 *
 * Faz-1 kararı: In-memory kullanıldı. Üretimde Redis veya veritabanı tablosu
 * gerekir (Faz 5'te eklenecek). Process restart'ta bekleyen tüm token'lar
 * geçersiz olur.
 */

interface ResetToken {
  token: string;
  userId: string;
  expiresAt: number;
  used: boolean;
}

@Injectable()
export class PasswordResetStore {
  private readonly logger = new Logger(PasswordResetStore.name);
  private readonly tokens = new Map<string, ResetToken>();

  issue(userId: string, ttlSeconds: number): string {
    const token = nanoid(48);
    this.tokens.set(token, {
      token,
      userId,
      expiresAt: Date.now() + ttlSeconds * 1000,
      used: false,
    });
    return token;
  }

  /**
   * Token'ı doğrula. Geçerliyse userId döner ve token used olarak işaretlenir
   * (tek kullanımlık). Tekrar kullanılırsa hata fırlatır.
   */
  verify(token: string): string {
    const stored = this.tokens.get(token);
    if (!stored) {
      throw new Error('Geçersiz veya süresi dolmuş token');
    }
    if (stored.used) {
      // Olası çalınma — tüm token'ları sil
      this.logger.warn(`Reset token re-used — possible attack — clearing all for user ${stored.userId}`);
      this.clearForUser(stored.userId);
      throw new Error('Token zaten kullanılmış');
    }
    if (Date.now() > stored.expiresAt) {
      this.tokens.delete(token);
      throw new Error('Token süresi dolmuş');
    }
    stored.used = true;
    return stored.userId;
  }

  clearForUser(userId: string): number {
    let n = 0;
    for (const [k, v] of this.tokens) {
      if (v.userId === userId) {
        this.tokens.delete(k);
        n++;
      }
    }
    return n;
  }

  size(): number {
    return this.tokens.size;
  }
}

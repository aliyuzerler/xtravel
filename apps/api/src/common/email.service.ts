import { Injectable, Logger } from '@nestjs/common';
import { env } from '../env';

/**
 * E-posta gönderim servisi — stub implementation.
 *
 * Faz-1 kararı: Sandbox'ta SMTP erişimi yok, bu yüzden e-posta gönderilmez;
 * reset link'i application log'una yazılır (konsolda görünür).
 *
 * Üretimde: Resend veya SMTP ile değiştirilecek (A2).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const url = `${env.PASSWORD_RESET_BASE_URL}?token=${token}`;
    this.logger.log(`📧 [E-POSTA STUB] → ${to}`);
    this.logger.log(`   Şifre sıfırlama linki: ${url}`);
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    this.logger.log(`📧 [E-POSTA STUB] Hoş geldin ${name} → ${to}`);
  }
}

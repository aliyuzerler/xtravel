import { Injectable, Logger } from '@nestjs/common';
import { env } from '../env';
import { CancelPolicyResult } from '../reservations/cancel-policy.service';

/**
 * E-posta gönderim servisi — stub implementation.
 *
 * Faz-1 kararı: Sandbox'ta SMTP erişimi yok, bu yüzden e-posta gönderilmez;
 * içerik application log'una yazılır (konsolda görünür).
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

  async sendReservationConfirmed(
    to: string,
    reservationCode: string,
    serviceTitle: string,
  ): Promise<void> {
    this.logger.log(`📧 [E-POSTA STUB] Rezervasyon Onayı → ${to}`);
    this.logger.log(`   Rezervasyon kodu: ${reservationCode}`);
    this.logger.log(`   Hizmet: ${serviceTitle}`);
    this.logger.log(`   Konu: Rezervasyonunuz Onaylandı ✓`);
  }

  async sendReservationCancelled(
    to: string,
    reservationCode: string,
    serviceTitle: string,
    refund?: CancelPolicyResult | null,
  ): Promise<void> {
    this.logger.log(`📧 [E-POSTA STUB] Rezervasyon İptali → ${to}`);
    this.logger.log(`   Rezervasyon kodu: ${reservationCode}`);
    this.logger.log(`   Hizmet: ${serviceTitle}`);
    if (refund) {
      this.logger.log(`   İade: %${refund.refundPercentage} (${refund.refundAmount}₺) — ${refund.tier}`);
      this.logger.log(`   Açıklama: ${refund.reason}`);
    }
    this.logger.log(`   Konu: Rezervasyonunuz İptal Edildi ✗`);
  }

  async sendRefundProcessed(
    to: string,
    reservationCode: string,
    refundAmount: number,
    reason: string,
  ): Promise<void> {
    this.logger.log(`📧 [E-POSTA STUB] İade İşlendi → ${to}`);
    this.logger.log(`   Rezervasyon kodu: ${reservationCode}`);
    this.logger.log(`   İade tutarı: ${refundAmount}₺`);
    this.logger.log(`   Sebep: ${reason}`);
    this.logger.log(`   Konu: İadeniz İşlendi 💰`);
  }

  async sendTourReminder(
    to: string,
    reservationCode: string,
    serviceTitle: string,
    tourStartAt: Date,
    meetingPoint?: string | null,
  ): Promise<void> {
    this.logger.log(`📧 [E-POSTA STUB] Tur Hatırlatması → ${to}`);
    this.logger.log(`   Rezervasyon kodu: ${reservationCode}`);
    this.logger.log(`   Hizmet: ${serviceTitle}`);
    this.logger.log(`   Tur başlangıcı: ${tourStartAt.toLocaleString('tr-TR')}`);
    if (meetingPoint) this.logger.log(`   Buluşma noktası: ${meetingPoint}`);
    this.logger.log(`   Konu: Yarın turunuz var! 📅`);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReservationsService } from '../reservations/reservations.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../common/email.service';
import { ReservationStatus } from '@turizm-pazaryeri/shared';

/**
 * Periyodik görevler (cron jobs).
 *
 * - cleanupExpiredReservations: her 5 dakikada bir (15dk TTL için yeterli)
 *   pending_payment rezervasyonlarını iptal eder.
 * - sendTourReminders: her saat başı, 24 saat içinde başlayacak turlar için
 *   confirmed rezervasyon sahiplerine hatırlatma e-postası gönderir.
 */
@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private reservationsService: ReservationsService,
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  /**
   * Her 5 dakikada bir — 15 dk TTL'i geçmiş pending_payment rezervasyonlarını iptal et.
   */
  @Cron('*/5 * * * *')
  async cleanupExpiredReservations() {
    try {
      const result = await this.reservationsService.cleanupExpiredReservations();
      if (result.cancelled > 0) {
        this.logger.log(`[CRON] cleanupExpiredReservations: ${result.cancelled} cancelled`);
      }
    } catch (err) {
      this.logger.error(`[CRON] cleanupExpiredReservations error: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Her saat başı — 24 saat içinde başlayacak turlar için confirmed rezervasyon
   * sahiplerine hatırlatma e-postası gönder (her rezervasyona yalnızca 1 kez).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sendTourReminders() {
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);

      // 23-24 saat içinde başlayacak confirmed rezervasyonlar
      const reservations = await this.prisma.reservation.findMany({
        where: {
          status: ReservationStatus.CONFIRMED,
          schedule: { startAt: { gte: in23h, lt: in24h } },
          // Daha önce hatırlatma gönderilmemiş kayıtlar
          // (basit çözüm: createdAt > 24 saat önceki olan ve henüz mail gönderilmeyen)
          // — Faz 5 için, her zaman üzerinden geçelim; mail stub olduğu için çift mail sorun olmaz
        },
        include: {
          service: { select: { title: true, meetingPoint: true } },
          schedule: { select: { startAt: true } },
        },
        take: 100,
      });

      if (reservations.length === 0) return;

      this.logger.log(`[CRON] sendTourReminders: ${reservations.length} upcoming tours`);

      for (const r of reservations) {
        try {
          await this.email.sendTourReminder(
            r.contactEmail,
            r.reservationCode,
            r.service.title,
            r.schedule.startAt,
            r.service.meetingPoint,
          );
        } catch (e) {
          this.logger.warn(`[CRON] sendTourReminder failed for ${r.id}: ${e instanceof Error ? e.message : e}`);
        }
      }
    } catch (err) {
      this.logger.error(`[CRON] sendTourReminders error: ${err instanceof Error ? err.message : err}`);
    }
  }
}

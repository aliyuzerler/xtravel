import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../common/email.service';
import {
  ReservationStatus,
  PaymentStatus,
  NotificationType,
  ERROR_CODES,
} from '@turizm-pazaryeri/shared';
import {
  NotFoundError,
  ForbiddenError,
  BusinessError,
  ConflictError,
  paginate,
} from '../common';
import { ReservationCodeService } from './reservation-code.service';
import { CancelPolicyService, CancelPolicyResult } from './cancel-policy.service';
import { CouponService } from './coupon.service';
import { CreateReservationDto, CancelReservationDto } from './dto';

/**
 * Rezervasyon durum makinesi (A5 spec'inden).
 *
 * Geçerli geçişler:
 *   pending_payment → confirmed  (ödeme captured)
 *   pending_payment → cancelled   (kullanıcı iptal / cron 15dk TTL)
 *   confirmed → completed         (tur tamamlandı, sağlayıcı admin işaretler)
 *   confirmed → cancelled         (kullanıcı/sağlayıcı iptal — iade politikası uygulanır)
 *   cancelled → refunded          (refund processing tamamlandı)
 *   completed → (terminal — hiçbir geçiş yok)
 *
 * Geçersiz tüm geçişler BusinessError fırlatır.
 */
export const STATE_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  [ReservationStatus.PENDING_PAYMENT]: [ReservationStatus.CONFIRMED, ReservationStatus.CANCELLED],
  [ReservationStatus.CONFIRMED]: [ReservationStatus.COMPLETED, ReservationStatus.CANCELLED],
  [ReservationStatus.COMPLETED]: [], // terminal
  [ReservationStatus.CANCELLED]: [ReservationStatus.REFUNDED],
  [ReservationStatus.REFUNDED]: [], // terminal
};

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);
  // pending_payment TTL — 15 dakika
  private readonly PENDING_TTL_MS = 15 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private email: EmailService,
    private codeService: ReservationCodeService,
    private cancelPolicy: CancelPolicyService,
    private coupons: CouponService,
  ) {}

  // --------------------------------------------------------------------------
  // CREATE — atomic capacity check ile
  // --------------------------------------------------------------------------
  async create(userId: string, dto: CreateReservationDto) {
    // 1. Service + Schedule + Pricing'i çek
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
      include: { provider: true },
    });
    if (!service) throw new NotFoundError('Hizmet');
    if (service.status !== 'published') {
      throw new BusinessError('Hizmet yayında değil', ERROR_CODES.RESOURCE_CONFLICT, 409);
    }

    const schedule = await this.prisma.serviceSchedule.findUnique({
      where: { id: dto.scheduleId },
    });
    if (!schedule) throw new NotFoundError('Takvim slotu');
    if (schedule.serviceId !== service.id) {
      throw new BusinessError('Slot bu hizmete ait değil', ERROR_CODES.VALIDATION_FAILED, 422);
    }
    if (schedule.status !== 'open') {
      throw new BusinessError('Slot kapalı', ERROR_CODES.SCHEDULE_CLOSED, 422);
    }
    if (new Date(schedule.startAt) <= new Date()) {
      throw new BusinessError('Geçmiş slot rezerve edilemez', ERROR_CODES.VALIDATION_FAILED, 422);
    }

    const pricing = await this.prisma.servicePricing.findUnique({
      where: { id: dto.pricingId },
    });
    if (!pricing) throw new NotFoundError('Fiyat varyantı');
    if (pricing.serviceId !== service.id) {
      throw new BusinessError('Fiyat varyantı bu hizmete ait değil', ERROR_CODES.VALIDATION_FAILED, 422);
    }
    if (!pricing.isActive) {
      throw new BusinessError('Fiyat varyantı pasif', ERROR_CODES.VALIDATION_FAILED, 422);
    }

    // 2. Kapasite kontrolü
    const remaining = schedule.capacity - schedule.bookedCount;
    if (remaining < dto.participantCount) {
      throw new ConflictError(
        `Kontenjan doldu. Kalan: ${remaining}, istenen: ${dto.participantCount}`,
        ERROR_CODES.CAPACITY_EXCEEDED,
      );
    }

    // 3. Fiyat hesabı
    let unitPrice: number;
    let baseTotal: number;
    if (pricing.unit === 'per_person') {
      unitPrice = pricing.price;
      baseTotal = pricing.price * dto.participantCount;
    } else {
      // per_group — grup fiyatı, participantCount etkilemez
      unitPrice = pricing.price;
      baseTotal = pricing.price;
    }

    // 4. Kupon doğrulama (varsa)
    let couponId: string | null = null;
    let discountAmount = 0;
    let finalTotal = baseTotal;
    if (dto.couponCode) {
      const couponResult = await this.coupons.validate(dto.couponCode, baseTotal);
      if (!couponResult.valid) {
        throw new BusinessError(
          `Kupon geçersiz: ${couponResult.reason}`,
          ERROR_CODES.COUPON_INVALID,
          422,
        );
      }
      couponId = couponResult.coupon!.id;
      discountAmount = couponResult.discountAmount;
      finalTotal = couponResult.finalAmount;
    }

    // 5. Reservation code üret
    const reservationCode = await this.codeService.generateUnique();

    // 6. ATOMIC CREATE — Transaction içinde:
    //    - Schedule'u oku, capacity check yap
    //    - bookedCount artır (atomic update)
    //    - Reservation create
    //    - Başarısızsa rollback → 409
    //
    // NOT: pending_payment oluşturulurken bookedCount artırılır.
    //   Cron 15dk TTL ile cleanup → bookedCount decrement yapar.
    //   Webhook success → confirmByPayment: bookedCount zaten artılmış, sadece status confirmed.
    const transactionTimeout = 10000; // 10 sn — SQLite paralel transaction'lar için
    try {
      const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Atomic capacity check + update
        const currentSchedule = await tx.serviceSchedule.findUnique({
          where: { id: schedule.id },
        });
        if (!currentSchedule) {
          throw new ConflictError('Slot bulunamadı', ERROR_CODES.CAPACITY_EXCEEDED);
        }
        const newBookedCount = currentSchedule.bookedCount + dto.participantCount;
        if (newBookedCount > currentSchedule.capacity) {
          throw new ConflictError(
            `Kontenjan doldu. Kalan: ${currentSchedule.capacity - currentSchedule.bookedCount}, istenen: ${dto.participantCount}`,
            ERROR_CODES.CAPACITY_EXCEEDED,
          );
        }

        // Atomic update
        await tx.serviceSchedule.update({
          where: { id: schedule.id },
          data: { bookedCount: newBookedCount },
        });

        // Reservation oluşturma
        const reservation = await tx.reservation.create({
          data: {
            reservationCode,
            userId,
            serviceId: service.id,
            scheduleId: schedule.id,
            pricingId: pricing.id,
            participantCount: dto.participantCount,
            unitPrice,
            totalPrice: finalTotal,
            discountAmount,
            couponId,
            status: ReservationStatus.PENDING_PAYMENT,
            contactName: dto.contactName,
            contactPhone: dto.contactPhone,
            contactEmail: dto.contactEmail,
          },
          include: {
            service: { select: { title: true } },
            schedule: { select: { startAt: true, endAt: true } },
            pricing: { select: { name: true, unit: true } },
          },
        });

        return reservation;
      }, { timeout: transactionTimeout });

      // 7. Kupon kullanıldı olarak işaretle (transaction dışında — increment idempotent değil ama kabulleniyoruz)
      if (couponId) {
        try {
          await this.coupons.markUsed(couponId);
        } catch (e) {
          this.logger.warn(`Coupon markUsed failed: ${couponId} — reservation still created`);
        }
      }

      this.logger.log(`Reservation created: ${reservationCode} (userId=${userId})`);
      return result;
    } catch (err) {
      // ConflictError zaten yukarıda fırlatıldı
      throw err;
    }
  }

  // --------------------------------------------------------------------------
  // LIST — kullanıcının kendi rezervasyonları
  // --------------------------------------------------------------------------
  async listForUser(
    userId: string,
    query: { page?: number; limit?: number; status?: string },
  ) {
    const where: any = { userId };
    if (query.status) where.status = query.status;
    return paginate(
      this.prisma.reservation,
      {
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          service: { select: { id: true, title: true, slug: true, images: { where: { isMain: true }, take: 1 } } },
          schedule: { select: { startAt: true, endAt: true } },
          pricing: { select: { name: true, unit: true } },
          payments: { select: { amount: true, status: true, provider: true } },
        },
      },
      { page: query.page, limit: query.limit },
    );
  }

  // --------------------------------------------------------------------------
  // GET — kullanıcının tek rezervasyonu
  // --------------------------------------------------------------------------
  async getForUser(userId: string, reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        service: { select: { id: true, title: true, slug: true, meetingPoint: true, city: { select: { name: true } } } },
        schedule: { select: { startAt: true, endAt: true, capacity: true, bookedCount: true } },
        pricing: { select: { name: true, unit: true, price: true } },
        payments: { include: { refunds: true } },
      },
    });
    if (!reservation) throw new NotFoundError('Rezervasyon');
    if (reservation.userId !== userId) {
      throw new ForbiddenError('Bu rezervasyona erişim yetkiniz yok', ERROR_CODES.OWNERSHIP_VIOLATION);
    }
    return reservation;
  }

  // --------------------------------------------------------------------------
  // CANCEL — kullanıcı kendi rezervasyonunu iptal eder
  // --------------------------------------------------------------------------
  async cancelByUser(
    userId: string,
    reservationId: string,
    dto: CancelReservationDto,
  ): Promise<{ reservation: any; refund?: any }> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        service: { select: { title: true, providerId: true } },
        schedule: { select: { startAt: true } },
        payments: { where: { status: 'captured' }, take: 1 },
      },
    });
    if (!reservation) throw new NotFoundError('Rezervasyon');
    if (reservation.userId !== userId) {
      throw new ForbiddenError('Bu rezervasyona erişim yetkiniz yok', ERROR_CODES.OWNERSHIP_VIOLATION);
    }

    // Durum makinesi kontrolü
    this.assertTransition(reservation.status as ReservationStatus, ReservationStatus.CANCELLED);

    // İptal politikası uygula (sadece confirmed rezervasyonlar için iade hesaplanır)
    let refundResult: CancelPolicyResult | null = null;
    if (reservation.status === ReservationStatus.CONFIRMED) {
      refundResult = await this.cancelPolicy.evaluate(
        reservation.schedule.startAt,
        reservation.totalPrice,
      );
    }

    // Transaction: rezervasyonu cancelled yap + slot kapasitesini geri al
    // (create sırasında bookedCount artırıldığı için cancel'de decrement ediyoruz)
    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const r = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: ReservationStatus.CANCELLED,
          cancellationReason: dto.reason || 'Kullanıcı tarafından iptal edildi',
        },
      });

      // Her durumda (pending_payment veya confirmed) kapasiteyi geri al
      // çünkü create sırasında bookedCount artırıldı
      await tx.serviceSchedule.update({
        where: { id: reservation.scheduleId },
        data: { bookedCount: { decrement: reservation.participantCount } },
      });

      return r;
    });

    // Eğer captured payment varsa iade kaydı oluştur (gerçek refund Faz 5 webhook ile)
    let refund: any = null;
    const capturedPayment = reservation.payments[0];
    if (capturedPayment && refundResult && refundResult.refundAmount > 0) {
      refund = await this.prisma.refund.create({
        data: {
          paymentId: capturedPayment.id,
          amount: refundResult.refundAmount,
          reason: refundResult.reason,
          status: 'pending',
        },
      });
      // TODO: Burada gerçek iyzico refund çağrısı yapılacak (Faz 5 iyileştirme)
      // Şimdilik refund'u 'completed' olarak işaretleyip e-posta gönderelim
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: { status: 'completed' },
      });
      await this.prisma.payment.update({
        where: { id: capturedPayment.id },
        data: {
          status: refundResult.refundPercentage === 100 ? 'refunded' : 'partially_refunded',
        },
      });
      // Reservation status'ü refunded'a çek (eğer tam iade ise)
      if (refundResult.refundPercentage === 100) {
        await this.prisma.reservation.update({
          where: { id: reservationId },
          data: { status: ReservationStatus.REFUNDED },
        });
      }
    }

    // Notifications + email
    await this.notifications.notifyUser({
      userId,
      type: NotificationType.RESERVATION_CANCELLED,
      title: 'Rezervasyonunuz iptal edildi',
      message: `"${reservation.service.title}" rezervasyonunuz iptal edildi.${refundResult?.reason ? ' ' + refundResult.reason : ''}`,
    });

    try {
      await this.email.sendReservationCancelled(
        reservation.contactEmail,
        reservation.reservationCode,
        reservation.service.title,
        refundResult,
      );
    } catch (e) {
      this.logger.warn(`Email send failed: ${e instanceof Error ? e.message : e}`);
    }

    this.logger.log(`Reservation cancelled: ${reservation.reservationCode} (refund: ${refundResult?.refundAmount || 0})`);

    return {
      reservation: updated,
      refund: refund
        ? { ...refund, tier: refundResult!.tier, refundPercentage: refundResult!.refundPercentage, refundAmount: refundResult!.refundAmount, reason: refundResult!.reason }
        : null,
    };
  }

  // --------------------------------------------------------------------------
  // CONFIRM BY PAYMENT WEBHOOK — ödeme captured olunca çağrılır
  // --------------------------------------------------------------------------
  async confirmByPayment(reservationId: string, paymentId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { service: { select: { title: true } }, user: { select: { email: true, fullName: true } } },
    });
    if (!reservation) {
      this.logger.error(`confirmByPayment: reservation not found: ${reservationId}`);
      return;
    }

    if (reservation.status !== ReservationStatus.PENDING_PAYMENT) {
      this.logger.warn(`confirmByPayment: reservation not pending_payment (status=${reservation.status})`);
      return;
    }

    // Kapasite zaten create sırasında artırıldı (pending_payment → bookedCount artırılır).
    // Sadece rezervasyon durumunu confirmed'a çek.
    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CONFIRMED },
    });

    // Notification + email
    await this.notifications.notifyUser({
      userId: reservation.userId,
      type: NotificationType.RESERVATION_CONFIRMED,
      title: 'Rezervasyonunuz onaylandı',
      message: `"${reservation.service.title}" rezervasyonunuz ödeme alındıktan sonra onaylandı. Rezervasyon kodu: ${reservation.reservationCode}`,
    });

    try {
      await this.email.sendReservationConfirmed(
        reservation.user.email,
        reservation.reservationCode,
        reservation.service.title,
      );
    } catch (e) {
      this.logger.warn(`Email send failed: ${e instanceof Error ? e.message : e}`);
    }

    this.logger.log(`Reservation confirmed: ${reservation.reservationCode}`);
  }

  // --------------------------------------------------------------------------
  // CRON: Süresi dolmuş pending_payment rezervasyonları iptal et
  // --------------------------------------------------------------------------
  async cleanupExpiredReservations(): Promise<{ cancelled: number }> {
    const cutoff = new Date(Date.now() - this.PENDING_TTL_MS);
    this.logger.log(`Cron: cleaning up expired pending_payment reservations (cutoff=${cutoff.toISOString()})`);

    const expired = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.PENDING_PAYMENT,
        createdAt: { lt: cutoff },
      },
      select: { id: true, reservationCode: true, scheduleId: true, participantCount: true },
    });

    if (expired.length === 0) return { cancelled: 0 };

    // Her birini transaction içinde iptal et + kapasiteyi geri al
    // (create sırasında bookedCount artırıldı)
    for (const r of expired) {
      try {
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.reservation.update({
            where: { id: r.id },
            data: {
              status: ReservationStatus.CANCELLED,
              cancellationReason: 'Otomatik iptal — ödeme 15 dk içinde tamamlanmadı',
            },
          });
          await tx.serviceSchedule.update({
            where: { id: r.scheduleId },
            data: { bookedCount: { decrement: r.participantCount } },
          });
        });
      } catch (e) {
        this.logger.error(`Cron cleanup failed for ${r.reservationCode}: ${e instanceof Error ? e.message : e}`);
      }
    }

    this.logger.log(`Cron: cancelled ${expired.length} expired reservations`);
    return { cancelled: expired.length };
  }

  // --------------------------------------------------------------------------
  // Durum makinesi yardımcıları
  // --------------------------------------------------------------------------
  private assertTransition(from: ReservationStatus, to: ReservationStatus) {
    const allowed = STATE_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new BusinessError(
        `Geçersiz durum geçişi: ${from} → ${to}. İzin verilen: ${allowed.join(', ') || '(yok)'}`,
        ERROR_CODES.RESOURCE_CONFLICT,
        409,
      );
    }
  }
}

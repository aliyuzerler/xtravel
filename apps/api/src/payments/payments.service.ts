import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReservationsService } from '../reservations/reservations.service';
import {
  PaymentStatus,
  PaymentProvider,
  ERROR_CODES,
} from '@turizm-pazaryeri/shared';
import {
  NotFoundError,
  ForbiddenError,
  BusinessError,
  ConflictError,
} from '../common';
import { env } from '../env';
import * as crypto from 'crypto';
import { InitPaymentDto, IyzicoWebhookDto } from './dto';

/**
 * Ödeme servisi — iyzico sandbox entegrasyonu (mock ile).
 *
 * Faz-5 kararı:
 *   Sandbox'ta gerçek iyzico API'sine erişim yok (gerçek API key yok).
 *   Bu yüzden:
 *     - initPayment(): mock checkout form verisi döner (sandbox URL'i simüle)
 *     - webhook: HMAC-SHA256 imza doğrulaması yapar (gerçek algoritma)
 *
 * Üretim için değişiklikler:
 *   - iyzipay.js npm paketi ekle
 *   - initPayment(): gerçek iyzipay.checkoutFormInitializeCreate çağrısı
 *   - webhook: zaten doğru algoritma, sadece secret doğru olmalı
 *
 * İmza doğrulaması:
 *   iyzico webhook'unda gelen signature, rawBody + secret_key ile HMAC-SHA256'dır.
 *   Bu implementasyon bunu birebir yapar — üretimde sadece IYZICO_SECRET_KEY env değişir.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  // Sandbox mock secret — üretimde env'den oku
  private readonly WEBHOOK_SECRET = env.JWT_ACCESS_SECRET || 'iyzico-sandbox-secret-change-me';

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private reservationsService: ReservationsService,
  ) {}

  // --------------------------------------------------------------------------
  // INIT — iyzico checkout form başlat
  // --------------------------------------------------------------------------
  async initPayment(userId: string, dto: InitPaymentDto) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: dto.reservationId },
      include: {
        service: { select: { title: true } },
        schedule: { select: { startAt: true } },
        pricing: { select: { name: true } },
      },
    });
    if (!reservation) throw new NotFoundError('Rezervasyon');
    if (reservation.userId !== userId) {
      throw new ForbiddenError('Bu rezervasyona erişim yetkiniz yok', ERROR_CODES.OWNERSHIP_VIOLATION);
    }
    if (reservation.status !== 'pending_payment') {
      throw new ConflictError(
        `Bu rezervasyon için ödeme başlatılamaz (durum: ${reservation.status})`,
        ERROR_CODES.PAYMENT_ALREADY_PROCESSED,
      );
    }

    // Önceki failed/initiated payment varsa ona ekle yoksa yeni oluştur
    const existingPayment = await this.prisma.payment.findFirst({
      where: { reservationId: reservation.id, status: { in: ['initiated', 'failed'] } },
      orderBy: { createdAt: 'desc' },
    });

    // Mock iyzico payment token üret
    const paymentToken = `mock-token-${reservation.id}-${Date.now()}`;
    const conversationId = `conv-${reservation.id}-${Date.now()}`;

    const payment = existingPayment
      ? await this.prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            amount: reservation.totalPrice,
            currency: 'TRY',
            provider: PaymentProvider.IYZICO,
            status: PaymentStatus.INITIATED,
            rawResponse: JSON.stringify({ paymentToken, conversationId, mock: true }),
          },
        })
      : await this.prisma.payment.create({
          data: {
            reservationId: reservation.id,
            amount: reservation.totalPrice,
            currency: 'TRY',
            provider: PaymentProvider.IYZICO,
            status: PaymentStatus.INITIATED,
            rawResponse: JSON.stringify({ paymentToken, conversationId, mock: true }),
          },
        });

    this.logger.log(`Payment initiated: paymentId=${payment.id} reservationId=${reservation.id}`);

    // Mock checkout form verisi
    // Sandbox URL: gerçek iyzico'da https://sandbox-api.iyzipay.com/checkoutform
    return {
      paymentId: payment.id,
      paymentToken,
      conversationId,
      checkoutFormContent: {
        token: paymentToken,
        url: `/api/payments/mock-checkout?token=${paymentToken}&paymentId=${payment.id}`,
        // Sandbox: kullanıcı bu URL'e POST yapınca mock başarılı/başarısız ödeme simüle edilir
      },
      amount: reservation.totalPrice,
      currency: 'TRY',
      reservation: {
        id: reservation.id,
        code: reservation.reservationCode,
        serviceTitle: reservation.service.title,
        scheduleStart: reservation.schedule.startAt,
        pricingName: reservation.pricing.name,
        participants: reservation.participantCount,
      },
      // Mock test için: webhook test endpoint'leri
      mockWebhooks: {
        success: `/api/payments/mock-callback?paymentId=${payment.id}&status=success`,
        failure: `/api/payments/mock-callback?paymentId=${payment.id}&status=failure`,
      },
    };
  }

  // --------------------------------------------------------------------------
  // WEBHOOK — iyzico'dan gelen callback, imza doğrulamalı
  // --------------------------------------------------------------------------
  async handleWebhook(dto: IyzicoWebhookDto, rawBody: string) {
    this.logger.log(`Webhook received: conversationId=${dto.conversationId} status=${dto.status}`);

    // İmza doğrulama
    const expectedSig = this.computeSignature(rawBody);
    if (dto.signature !== expectedSig) {
      this.logger.warn(`Webhook signature mismatch: expected=${expectedSig.slice(0, 16)}... got=${dto.signature.slice(0, 16)}...`);
      throw new BusinessError('Geçersiz webhook imzası', ERROR_CODES.AUTH_TOKEN_INVALID, 401);
    }

    // Payment'ı bul (conversationId ile, raw_response içinde)
    const payment = await this.prisma.payment.findFirst({
      where: { rawResponse: { contains: dto.conversationId } },
    });
    if (!payment) {
      this.logger.warn(`Webhook: payment not found for conversationId=${dto.conversationId}`);
      throw new NotFoundError('Ödeme kaydı');
    }

    // Zaten captured ise idempotent dön
    if (payment.status === 'captured') {
      this.logger.log(`Webhook idempotent: payment ${payment.id} already captured`);
      return { processed: true, paymentId: payment.id, status: 'captured' };
    }

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: payment.reservationId },
      select: { id: true, status: true, contactEmail: true },
    });
    if (!reservation) {
      this.logger.error(`Webhook: reservation not found for payment ${payment.id}`);
      return { processed: false };
    }

    if (dto.status === 'success') {
      // Payment = captured
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.CAPTURED,
          providerTransactionId: dto.paymentId || `iyz-${payment.id}`,
          rawResponse: JSON.stringify({
            ...(payment.rawResponse ? safeParse(payment.rawResponse) : {}),
            webhook: { status: dto.status, conversationId: dto.conversationId, paymentId: dto.paymentId, at: new Date().toISOString() },
          }),
        },
      });

      // Reservation = confirmed (kapasite artırımı içeride)
      await this.reservationsService.confirmByPayment(reservation.id, payment.id);

      this.logger.log(`Webhook SUCCESS: payment ${payment.id} captured, reservation ${reservation.id} confirmed`);
      return { processed: true, paymentId: payment.id, status: 'captured' };
    } else {
      // failure
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          rawResponse: JSON.stringify({
            ...(payment.rawResponse ? safeParse(payment.rawResponse) : {}),
            webhook: { status: dto.status, errorCode: dto.errorCode, errorMessage: dto.errorMessage, at: new Date().toISOString() },
          }),
        },
      });

      // Reservation durumu pending_payment kalır (cron 15dk sonra iptal eder)
      // Reservation'dan gerçek userId'yi alalım
      const fullReservation = await this.prisma.reservation.findUnique({
        where: { id: reservation.id },
        select: { userId: true },
      });
      if (fullReservation) {
        await this.notifications.notifyUser({
          userId: fullReservation.userId,
          type: 'payment_failed',
          title: 'Ödeme başarısız',
          message: 'Ödemeniz alınamadı. Lütfen tekrar deneyin.',
        });
      }

      this.logger.warn(`Webhook FAILURE: payment ${payment.id} failed (${dto.errorCode}: ${dto.errorMessage})`);
      return { processed: true, paymentId: payment.id, status: 'failed' };
    }
  }

  // --------------------------------------------------------------------------
  // MOCK CALLBACK — sandbox test için, gerçek webhook simülasyonu
  // --------------------------------------------------------------------------
  async mockCallback(paymentId: string, status: 'success' | 'failure') {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundError('Ödeme');

    // Webhook'a gönderilecek raw body + signature üret
    const rawBody = JSON.stringify({
      conversationId: safeParse(payment.rawResponse)?.conversationId,
      status,
      paymentId: `mock-${payment.id}`,
      ...(status === 'failure' ? { errorCode: 'CARD_REJECTED', errorMessage: 'Test: kart reddedildi' } : {}),
    });
    const signature = this.computeSignature(rawBody);

    // Webhook handler'ı çağır
    return this.handleWebhook({
      signature,
      conversationId: safeParse(payment.rawResponse)?.conversationId,
      status,
      paymentId: `mock-${payment.id}`,
      ...(status === 'failure' ? { errorCode: 'CARD_REJECTED', errorMessage: 'Test: kart reddedildi' } : {}),
      rawBody,
    }, rawBody);
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------
  /**
   * iyzico webhook imzası: HMAC-SHA256(rawBody, secret).
   * Hex formatında döner.
   */
  private computeSignature(rawBody: string): string {
    return crypto
      .createHmac('sha256', this.WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
  }
}

function safeParse(s: string | null | undefined): any {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return {}; }
}

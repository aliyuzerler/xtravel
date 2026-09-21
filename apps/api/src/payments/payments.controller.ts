import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles, ResponseInterceptor, RequestUser } from '../common';
import { UserRole } from '@turizm-pazaryeri/shared';
import { PaymentsService } from './payments.service';
import { InitPaymentDto } from './dto';

/**
 * Ödeme API'si.
 *
 * - init: kullanıcı kimlik doğrulamalı
 * - webhook: PUBLIC (iyzico'dan gelir) — imza doğrulaması yapılır
 * - mock-callback: sandbox test için (public — test amaçlı)
 */
@Controller()
@UseInterceptors(ResponseInterceptor)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /api/payments/init
   * Bir rezervasyon için ödeme başlatır (iyzico checkout form).
   */
  @Post('payments/init')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.SUPER_ADMIN)
  async initPayment(
    @Req() req: Express.Request & { user: RequestUser },
    @Body() dto: InitPaymentDto,
  ) {
    return this.paymentsService.initPayment(req.user.sub, dto);
  }

  /**
   * POST /api/payments/webhook
   * iyzico'dan gelen ödeme sonucu callback.
   * PUBLIC — Authorization header yok. İmza doğrulaması zorunlu.
   */
  @Post('payments/webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(@Req() req: Request & { rawBody?: Buffer }) {
    // Raw body'i string olarak al
    let rawBody = '';
    if (req.rawBody) {
      rawBody = req.rawBody.toString('utf8');
    } else {
      // Fallback — buf'ı biriktir
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk as Buffer);
      }
      rawBody = Buffer.concat(chunks).toString('utf8');
    }

    let dto;
    try {
      dto = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Geçersiz JSON body');
    }

    return this.paymentsService.handleWebhook(dto, rawBody);
  }

  /**
   * GET /api/payments/mock-callback?paymentId=X&status=success|failure
   * SANDBOX TEST İÇİN — gerçek iyzico webhook'unu simüle eder.
   * Üretimde bu endpoint kaldırılır.
   */
  @Get('payments/mock-callback')
  @HttpCode(HttpStatus.OK)
  async mockCallback(
    @Query('paymentId') paymentId: string,
    @Query('status') status: 'success' | 'failure',
  ) {
    if (!paymentId || !['success', 'failure'].includes(status)) {
      throw new BadRequestException('paymentId ve status (success|failure) gerekli');
    }
    return this.paymentsService.mockCallback(paymentId, status);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiscountType, ERROR_CODES } from '@turizm-pazaryeri/shared';
import { BusinessError, NotFoundError } from '../common';

export interface CouponValidationResult {
  valid: boolean;
  coupon?: any;
  discountAmount: number;
  finalAmount: number;
  reason?: string;
}

@Injectable()
export class CouponService {
  private readonly logger = new Logger(CouponService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Kupon kodu doğrular ve indirim hesaplar.
   *
   * Doğrulama kuralları:
   *   - Kupon var ve aktif
   *   - Geçerlilik tarihleri içinde
   *   - Kullanım limiti dolmamış (used_count < usage_limit)
   *   - Sepet tutarı >= min_amount
   *
   * İndirim hesabı:
   *   - PERCENTAGE: discount_value / 100 × totalAmount
   *   - FIXED: discount_value (doğrudan)
   */
  async validate(
    code: string,
    totalAmount: number,
  ): Promise<CouponValidationResult> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!coupon) {
      return { valid: false, discountAmount: 0, finalAmount: totalAmount, reason: 'Geçersiz kupon kodu' };
    }

    if (!coupon.isActive) {
      return { valid: false, discountAmount: 0, finalAmount: totalAmount, reason: 'Kupon pasif' };
    }

    const now = new Date();
    if (now < coupon.validFrom) {
      return { valid: false, discountAmount: 0, finalAmount: totalAmount, reason: 'Kupon henüz başlamamış' };
    }
    if (now > coupon.validTo) {
      return { valid: false, discountAmount: 0, finalAmount: totalAmount, reason: 'Kupon süresi dolmuş' };
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, discountAmount: 0, finalAmount: totalAmount, reason: 'Kupon kullanım limiti dolmuş' };
    }

    if (totalAmount < coupon.minAmount) {
      return {
        valid: false,
        discountAmount: 0,
        finalAmount: totalAmount,
        reason: `Minimum sepet tutarı ${coupon.minAmount}₺ olmalı`,
      };
    }

    // İndirim hesabı
    let discountAmount: number;
    if (coupon.discountType === DiscountType.PERCENTAGE) {
      discountAmount = Math.round((totalAmount * coupon.discountValue) / 100 * 100) / 100;
    } else {
      // FIXED
      discountAmount = Math.min(coupon.discountValue, totalAmount);
    }

    return {
      valid: true,
      coupon,
      discountAmount,
      finalAmount: totalAmount - discountAmount,
    };
  }

  /**
   * Başarılı bir rezervasyonda kuponu "kullan" (used_count artır).
   */
  async markUsed(couponId: string): Promise<void> {
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });
    this.logger.log(`Coupon used: ${couponId}`);
  }
}

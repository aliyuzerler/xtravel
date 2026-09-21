import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * İptal politikası servisi.
 *
 * Settings tablosundan cancel_policy_hours (ücretsiz iptal eşiği, saat)
 * değerini okur. Politikalar:
 *   - Tur başlangıcı ≥ cancel_policy_hours önce: %100 iade
 *   - Tur başlangıcı 24-48s önce (yani 24s≤gap<48s varsayılan): %50 iade
 *   - Tur başlangıcı <24s önce: %0 iade
 *
 * Aslında daha genel:
 *   - gap >= policy_hours → FULL (%100)
 *   - gap >= policy_hours/2 → HALF (%50)
 *   - gap < policy_hours/2 → NONE (%0)
 *
 * Üretimde bu kurallar settings tablosuna JSON olarak taşınabilir (Faz 5+).
 */
export type RefundTier = 'FULL' | 'HALF' | 'NONE';

export interface CancelPolicyResult {
  tier: RefundTier;
  refundPercentage: number; // 0-100
  refundAmount: number;
  keepAmount: number;
  reason: string;
}

@Injectable()
export class CancelPolicyService {
  private readonly logger = new Logger(CancelPolicyService.name);
  private readonly DEFAULT_HOURS = 24;

  constructor(private prisma: PrismaService) {}

  /**
   * Tur başlangıç zamanına göre iptal politikası uygular.
   */
  async evaluate(
    tourStartAt: Date,
    totalAmount: number,
    cancelAt: Date = new Date(),
  ): Promise<CancelPolicyResult> {
    const policyHours = await this.getPolicyHours();
    const gapHours = (tourStartAt.getTime() - cancelAt.getTime()) / (1000 * 60 * 60);

    let tier: RefundTier;
    let refundPercentage: number;
    let reason: string;

    if (gapHours >= policyHours) {
      tier = 'FULL';
      refundPercentage = 100;
      reason = `Tur başlangıcına ${gapHours.toFixed(1)} saat var (≥ ${policyHours}s politikası) — tam iade.`;
    } else if (gapHours >= policyHours / 2) {
      tier = 'HALF';
      refundPercentage = 50;
      reason = `Tur başlangıcına ${gapHours.toFixed(1)} saat var (${policyHours / 2}-${policyHours}s arası) — %50 iade.`;
    } else if (gapHours > 0) {
      tier = 'NONE';
      refundPercentage = 0;
      reason = `Tur başlangıcına ${gapHours.toFixed(1)} saat var (< ${policyHours / 2}s) — iade yok.`;
    } else {
      // Tur başlamış veya geçmiş — iade yok
      tier = 'NONE';
      refundPercentage = 0;
      reason = 'Tur başlamış veya tamamlanmış — iade yok.';
    }

    const refundAmount = Math.round((totalAmount * refundPercentage) / 100 * 100) / 100;
    const keepAmount = totalAmount - refundAmount;

    return { tier, refundPercentage, refundAmount, keepAmount, reason };
  }

  /**
   * Settings tablosundan cancel_policy_hours değerini okur.
   * Yoksa default (24 saat) döner.
   */
  async getPolicyHours(): Promise<number> {
    try {
      const s = await this.prisma.setting.findUnique({ where: { key: 'cancel_policy_hours' } });
      if (!s) return this.DEFAULT_HOURS;
      const parsed = JSON.parse(s.value);
      const n = typeof parsed === 'number' ? parsed : Number(parsed);
      return Number.isFinite(n) && n > 0 ? n : this.DEFAULT_HOURS;
    } catch (e) {
      this.logger.warn(`cancel_policy_hours okunamadı, default kullanılıyor: ${this.DEFAULT_HOURS}`);
      return this.DEFAULT_HOURS;
    }
  }

  /**
   * İptal politikası metnini settings'ten okur (kullanıcıya gösterilecek).
   */
  async getPolicyText(): Promise<string> {
    try {
      const s = await this.prisma.setting.findUnique({ where: { key: 'cancel_policy_text' } });
      if (!s) return this.defaultText();
      const parsed = JSON.parse(s.value);
      return typeof parsed === 'string' ? parsed : this.defaultText();
    } catch {
      return this.defaultText();
    }
  }

  private defaultText(): string {
    return 'Rezervasyon başlangıcından 24 saat öncesine kadar ücretsiz iptal. Sonrasında %50 kesinti uygulanır.';
  }
}

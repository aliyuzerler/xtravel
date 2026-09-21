import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Rezervasyon kodu üretici.
 * Format: TR-XXXXXX (6 karakter alfanümerik, büyük harf + rakam, karıştırılabilir olmayan karakterler hariç).
 *
 * Örnek: TR-8F3K2M, TR-A9B2XQ
 *
 * Strateji:
 *   1. Rastgele 6 karakter üret (I, O, 0, 1 gibi belirsiz karakterler hariç)
 *   2. Veritabanında benzersizlik kontrolü
 *   3. Çakışma varsa yeniden dene (en fazla 10 kez)
 */
@Injectable()
export class ReservationCodeService {
  private readonly logger = new Logger(ReservationCodeService.name);
  // I, O, 0, 1 gibi belirsiz karakterler hariç
  private readonly ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  private readonly PREFIX = 'TR';
  private readonly LENGTH = 6;
  private readonly MAX_ATTEMPTS = 10;

  constructor(private prisma: PrismaService) {}

  /**
   * Veritabanında benzersiz bir rezervasyon kodu üretir.
   */
  async generateUnique(): Promise<string> {
    for (let attempt = 0; attempt < this.MAX_ATTEMPTS; attempt++) {
      const code = this.generate();
      const exists = await this.prisma.reservation.findUnique({
        where: { reservationCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    // Fallback: timestamp ekle (long-shot ama asla patlamamalı)
    const fallback = `${this.PREFIX}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    this.logger.warn(`Reservation code fallback after ${this.MAX_ATTEMPTS} attempts: ${fallback}`);
    return fallback;
  }

  private generate(): string {
    const chars: string[] = [];
    for (let i = 0; i < this.LENGTH; i++) {
      chars.push(this.ALPHABET[Math.floor(Math.random() * this.ALPHABET.length)]);
    }
    return `${this.PREFIX}-${chars.join('')}`;
  }
}

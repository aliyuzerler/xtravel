import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Gelişmiş raporlama servisi.
 *
 * Sağlayıcı:
 *   - Doluluk oranı (bookedCount / capacity toplam)
 *   - İptal oranı (cancelled / total reservations)
 *   - Aylık kazanç grafiği (son 6 ay)
 *   - CSV export için raw data
 *
 * Admin:
 *   - Kategori bazlı satış
 *   - Şehir bazlı satış
 *   - Komisyon geliri
 *   - Sağlayıcı sıralaması (gelir bazında)
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private prisma: PrismaService) {}

  // ===========================================================================
  // SAĞLAYICI RAPORLARI
  // ===========================================================================

  /**
   * Sağlayıcı doluluk oranı — tüm hizmetlerinin gelecek slotları için.
   * Doluluk = sum(bookedCount) / sum(capacity)
   */
  async getProviderOccupancy(providerId: string): Promise<{
    totalCapacity: number;
    totalBooked: number;
    occupancyRate: number;
    byService: Array<{ serviceId: string; serviceTitle: string; capacity: number; booked: number; rate: number }>;
  }> {
    const schedules = await this.prisma.serviceSchedule.findMany({
      where: {
        service: { providerId },
        startAt: { gte: new Date() },
        status: 'open',
      },
      select: {
        capacity: true,
        bookedCount: true,
        service: { select: { id: true, title: true } },
      },
    });

    const byServiceMap = new Map<string, { title: string; capacity: number; booked: number }>();
    let totalCapacity = 0;
    let totalBooked = 0;

    for (const s of schedules) {
      totalCapacity += s.capacity;
      totalBooked += s.bookedCount;
      const key = s.service.id;
      if (!byServiceMap.has(key)) {
        byServiceMap.set(key, { title: s.service.title, capacity: 0, booked: 0 });
      }
      const entry = byServiceMap.get(key)!;
      entry.capacity += s.capacity;
      entry.booked += s.bookedCount;
    }

    const byService = Array.from(byServiceMap.entries()).map(([serviceId, data]) => ({
      serviceId,
      serviceTitle: data.title,
      capacity: data.capacity,
      booked: data.booked,
      rate: data.capacity > 0 ? (data.booked / data.capacity) * 100 : 0,
    }));

    return {
      totalCapacity,
      totalBooked,
      occupancyRate: totalCapacity > 0 ? (totalBooked / totalCapacity) * 100 : 0,
      byService,
    };
  }

  /**
   * Sağlayıcı iptal oranı.
   */
  async getProviderCancellationRate(providerId: string): Promise<{
    total: number;
    cancelled: number;
    rate: number;
  }> {
    const [total, cancelled] = await Promise.all([
      this.prisma.reservation.count({
        where: { service: { providerId } },
      }),
      this.prisma.reservation.count({
        where: { service: { providerId }, status: 'cancelled' },
      }),
    ]);
    return {
      total,
      cancelled,
      rate: total > 0 ? (cancelled / total) * 100 : 0,
    };
  }

  /**
   * Sağlayıcı aylık kazanç grafiği (son 6 ay).
   */
  async getProviderMonthlyEarnings(providerId: string, months = 6): Promise<
    Array<{ label: string; year: number; month: number; revenue: number; net: number; reservationCount: number }>
  > {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        service: { providerId },
        status: 'completed',
        createdAt: { gte: startDate },
      },
      select: { totalPrice: true, createdAt: true },
    });

    const commissionRate = await this.getCommissionRate();
    const buckets = this.generateMonthBuckets(months);
    const monthMap: Record<string, { revenue: number; count: number }> = {};
    for (const b of buckets) monthMap[`${b.year}-${b.month}`] = { revenue: 0, count: 0 };

    for (const r of reservations) {
      const key = `${r.createdAt.getFullYear()}-${r.createdAt.getMonth() + 1}`;
      if (monthMap[key]) {
        monthMap[key].revenue += r.totalPrice;
        monthMap[key].count += 1;
      }
    }

    return buckets.map((b) => {
      const data = monthMap[`${b.year}-${b.month}`];
      return {
        ...b,
        revenue: data.revenue,
        net: data.revenue * (1 - commissionRate),
        reservationCount: data.count,
      };
    });
  }

  /**
   * Sağlayıcı için CSV export — rezervasyon listesi.
   */
  async exportProviderReservationsCSV(providerId: string): Promise<string> {
    const reservations = await this.prisma.reservation.findMany({
      where: { service: { providerId } },
      orderBy: { createdAt: 'desc' },
      include: {
        service: { select: { title: true } },
        schedule: { select: { startAt: true } },
        pricing: { select: { name: true } },
      },
    });

    const header = 'Rezervasyon Kodu,Hizmet,Tarih,Katilimci,Birim Fiyat,Toplam,Indirim,Durum,Iletisim Adi,E-posta,Telefon,Olusturma Tarihi';
    const rows = reservations.map((r) => {
      return [
        r.reservationCode,
        this.csvEscape(r.service.title),
        new Date(r.schedule.startAt).toLocaleDateString('tr-TR'),
        r.participantCount,
        r.unitPrice,
        r.totalPrice,
        r.discountAmount,
        r.status,
        this.csvEscape(r.contactName),
        r.contactEmail,
        r.contactPhone,
        new Date(r.createdAt).toISOString(),
      ].join(',');
    });
    return [header, ...rows].join('\n');
  }

  // ===========================================================================
  // ADMİN RAPORLARI
  // ===========================================================================

  /**
   * Kategori bazlı satış — her kategori için rezervasyon sayısı + ciro.
   */
  async getAdminCategorySales(): Promise<Array<{
    categoryId: string;
    categoryName: string;
    reservationCount: number;
    revenue: number;
  }>> {
    const categories = await this.prisma.category.findMany({
      include: {
        services: {
          select: {
            reservations: {
              where: { status: 'completed' },
              select: { totalPrice: true },
            },
          },
        },
      },
    });

    return categories.map((c) => {
      const reservations = c.services.flatMap((s) => s.reservations);
      const revenue = reservations.reduce((sum, r) => sum + r.totalPrice, 0);
      return {
        categoryId: c.id,
        categoryName: c.name,
        reservationCount: reservations.length,
        revenue,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Şehir bazlı satış.
   */
  async getAdminCitySales(): Promise<Array<{
    cityId: string;
    cityName: string;
    reservationCount: number;
    revenue: number;
  }>> {
    const cities = await this.prisma.city.findMany({
      include: {
        services: {
          select: {
            reservations: {
              where: { status: 'completed' },
              select: { totalPrice: true },
            },
          },
        },
      },
    });

    return cities.map((c) => {
      const reservations = c.services.flatMap((s) => s.reservations);
      const revenue = reservations.reduce((sum, r) => sum + r.totalPrice, 0);
      return {
        cityId: c.id,
        cityName: c.name,
        reservationCount: reservations.length,
        revenue,
      };
    }).filter((c) => c.reservationCount > 0).sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Komisyon geliri — tüm captured ödemelerin %commission'ı.
   */
  async getAdminCommissionRevenue(): Promise<{
    totalRevenue: number;
    commissionRate: number;
    commissionRevenue: number;
    byMonth: Array<{ label: string; revenue: number; commission: number }>;
  }> {
    const commissionRate = await this.getCommissionRate();

    const payments = await this.prisma.payment.findMany({
      where: { status: 'captured' },
      select: { amount: true, createdAt: true },
    });

    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
    const commissionRevenue = totalRevenue * commissionRate;

    // Aylık breakdown (son 6 ay)
    const now = new Date();
    const buckets = this.generateMonthBuckets(6);
    const monthMap: Record<string, number> = {};
    for (const b of buckets) monthMap[`${b.year}-${b.month}`] = 0;

    for (const p of payments) {
      const key = `${p.createdAt.getFullYear()}-${p.createdAt.getMonth() + 1}`;
      if (key in monthMap) monthMap[key] += p.amount;
    }

    const byMonth = buckets.map((b) => ({
      label: b.label,
      revenue: monthMap[`${b.year}-${b.month}`],
      commission: monthMap[`${b.year}-${b.month}`] * commissionRate,
    }));

    return { totalRevenue, commissionRate, commissionRevenue, byMonth };
  }

  /**
   * Sağlayıcı sıralaması (gelir bazında).
   */
  async getAdminProviderRanking(): Promise<Array<{
    providerId: string;
    companyName: string;
    reservationCount: number;
    revenue: number;
    netEarnings: number;
  }>> {
    const commissionRate = await this.getCommissionRate();
    const providers = await this.prisma.serviceProvider.findMany({
      where: { status: 'approved' },
      include: {
        services: {
          select: {
            reservations: {
              where: { status: 'completed' },
              select: { totalPrice: true },
            },
          },
        },
      },
    });

    return providers.map((p) => {
      const reservations = p.services.flatMap((s) => s.reservations);
      const revenue = reservations.reduce((sum, r) => sum + r.totalPrice, 0);
      return {
        providerId: p.id,
        companyName: p.companyName,
        reservationCount: reservations.length,
        revenue,
        netEarnings: revenue * (1 - commissionRate),
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================
  private async getCommissionRate(): Promise<number> {
    const s = await this.prisma.setting.findUnique({ where: { key: 'commission_rate' } });
    if (!s) return 0.10;
    try { return JSON.parse(s.value); } catch { return 0.10; }
  }

  private generateMonthBuckets(months: number) {
    const now = new Date();
    const buckets = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`,
      });
    }
    return buckets;
  }

  private csvEscape(s: string | null): string {
    if (!s) return '';
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }
}

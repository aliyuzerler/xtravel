import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, paginate } from '../common';
import { ServiceStatus, ServiceSortOption } from '@turizm-pazaryeri/shared';

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(private prisma: PrismaService) {}

  // --------------------------------------------------------------------------
  // CITIES (active only)
  // --------------------------------------------------------------------------
  async listCities() {
    return this.prisma.city.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    });
  }

  // --------------------------------------------------------------------------
  // CATEGORIES (active only, with published service count)
  // --------------------------------------------------------------------------
  async listCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        iconName: true,
        _count: { select: { services: { where: { status: ServiceStatus.PUBLISHED } } } },
      },
    });
  }

  // --------------------------------------------------------------------------
  // SERVICES LIST (filter + paginate + only published)
  // --------------------------------------------------------------------------
  async listServices(query: {
    page?: number;
    limit?: number;
    city?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    date?: string;
    search?: string;
    sort?: ServiceSortOption | string;
  }) {
    const where: any = { status: ServiceStatus.PUBLISHED };

    if (query.city) {
      where.city = { slug: query.city };
    }
    if (query.category) {
      where.category = { slug: query.category };
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
      ];
    }

    // Fiyat filtresi — service_pricing ile join mantığı
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.pricing = {
        some: {
          isActive: true,
          ...(query.minPrice !== undefined ? { price: { gte: query.minPrice } } : {}),
          ...(query.maxPrice !== undefined ? { price: { lte: query.maxPrice } } : {}),
          ...(query.minPrice !== undefined && query.maxPrice !== undefined
            ? { price: { gte: query.minPrice, lte: query.maxPrice } }
            : {}),
        },
      };
    }

    // Tarih filtresi — service_schedules ile
    if (query.date) {
      const dayStart = new Date(query.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      where.schedules = {
        some: {
          startAt: { gte: dayStart, lt: dayEnd },
          status: 'open',
          bookedCount: { lt: { /* capacity — runtime comparison */ } },
        },
      };
      // bookedCount < capacity SQLite'ta Prisma'da karmaşık; bunun yerine
      // service listesinde sadece açık slot var mı kontrolü yapıyoruz,
      // tam dolu slot filtrelemeyi service detail tarafında yapacağız.
    }

    // Sıralama
    let orderBy: any = { createdAt: 'desc' };
    switch (query.sort) {
      case ServiceSortOption.PRICE_ASC:
        orderBy = { pricing: { _min: { price: 'asc' } } };
        break;
      case ServiceSortOption.PRICE_DESC:
        orderBy = { pricing: { _max: { price: 'desc' } } };
        break;
      case ServiceSortOption.DURATION_ASC:
        orderBy = { durationHours: 'asc' };
        break;
      case ServiceSortOption.DURATION_DESC:
        orderBy = { durationHours: 'desc' };
        break;
      case ServiceSortOption.POPULAR:
        orderBy = { reservations: { _count: 'desc' } };
        break;
      case ServiceSortOption.FEATURED:
        orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
        break;
      case ServiceSortOption.NEWEST:
      default:
        orderBy = { createdAt: 'desc' };
    }

    const result = await paginate(
      this.prisma.service,
      {
        where,
        orderBy,
        include: {
          category: { select: { name: true, slug: true } },
          city: { select: { name: true, slug: true } },
          images: {
            where: { isMain: true },
            take: 1,
          },
          pricing: {
            where: { isActive: true },
            orderBy: { price: 'asc' },
            take: 1,
          },
          provider: {
            select: { id: true, companyName: true },
          },
        },
      },
      { page: query.page, limit: query.limit },
    );

    // En düşük fiyatı her hizmet için hesapla (minPrice/maxPrice sort için)
    if (query.sort === ServiceSortOption.PRICE_ASC || query.sort === ServiceSortOption.PRICE_DESC) {
      const itemsWithMinPrice = await Promise.all(
        result.items.map(async (s: any) => {
          const minP = await this.prisma.servicePricing.findFirst({
            where: { serviceId: s.id, isActive: true },
            orderBy: { price: 'asc' },
            select: { price: true },
          });
          return { ...s, startingPrice: minP?.price ?? null };
        }),
      );
      if (query.sort === ServiceSortOption.PRICE_ASC) {
        itemsWithMinPrice.sort((a, b) => (a.startingPrice ?? 0) - (b.startingPrice ?? 0));
      } else {
        itemsWithMinPrice.sort((a, b) => (b.startingPrice ?? 0) - (a.startingPrice ?? 0));
      }
      result.items = itemsWithMinPrice as any;
    } else {
      // startingPrice ekle
      const itemsWithMinPrice = await Promise.all(
        result.items.map(async (s: any) => {
          const minP = await this.prisma.servicePricing.findFirst({
            where: { serviceId: s.id, isActive: true },
            orderBy: { price: 'asc' },
            select: { price: true },
          });
          return { ...s, startingPrice: minP?.price ?? null };
        }),
      );
      result.items = itemsWithMinPrice as any;
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // FEATURED SERVICES
  // --------------------------------------------------------------------------
  async listFeaturedServices(limit = 8) {
    const services = await this.prisma.service.findMany({
      where: { status: ServiceStatus.PUBLISHED, isFeatured: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        category: { select: { name: true, slug: true } },
        city: { select: { name: true, slug: true } },
        images: { where: { isMain: true }, take: 1 },
        pricing: { where: { isActive: true }, orderBy: { price: 'asc' }, take: 1 },
        provider: { select: { companyName: true } },
      },
    });

    // startingPrice ekle
    return Promise.all(
      services.map(async (s: any) => {
        const minP = await this.prisma.servicePricing.findFirst({
          where: { serviceId: s.id, isActive: true },
          orderBy: { price: 'asc' },
          select: { price: true },
        });
        return { ...s, startingPrice: minP?.price ?? null };
      }),
    );
  }

  // --------------------------------------------------------------------------
  // SERVICE DETAIL (slug, only published)
  // --------------------------------------------------------------------------
  async getServiceBySlug(slug: string) {
    const service = await this.prisma.service.findUnique({
      where: { slug },
      include: {
        provider: {
          select: { id: true, companyName: true, phone: true, description: true },
        },
        category: { select: { id: true, name: true, slug: true, iconName: true } },
        city: { select: { id: true, name: true, slug: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        pricing: { where: { isActive: true }, orderBy: { price: 'asc' } },
        schedules: {
          where: {
            startAt: { gte: new Date() },
            status: 'open',
          },
          orderBy: { startAt: 'asc' },
        },
      },
    });
    if (!service) throw new NotFoundError('Hizmet');
    if (service.status !== ServiceStatus.PUBLISHED) {
      throw new NotFoundError('Hizmet');
    }

    // Kapasitesi dolu slotları hariç tut
    const availableSchedules = service.schedules.filter((s: any) => s.bookedCount < s.capacity);

    return {
      ...service,
      schedules: availableSchedules,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  UserRole,
  UserStatus,
  ProviderStatus,
  ServiceStatus,
  NotificationType,
  ERROR_CODES,
} from '@turizm-pazaryeri/shared';
import {
  NotFoundError,
  ConflictError,
  BusinessError,
  ForbiddenError,
} from '../common/errors';
import { paginate } from '../common/paginate';
import {
  ApproveProviderDto,
  RejectProviderDto,
  ApproveServiceDto,
  RejectServiceDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateCityDto,
  UpdateCityDto,
  UpdateUserStatusDto,
} from './dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ===========================================================================
  // DASHBOARD STATS
  // ===========================================================================
  async getDashboardStats() {
    const [
      totalUsers,
      totalProviders,
      totalServices,
      publishedServices,
      pendingProviders,
      pendingServices,
      totalReservations,
      activeReservations,
      totalRevenueRow,
      monthlyStats,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.serviceProvider.count(),
      this.prisma.service.count(),
      this.prisma.service.count({ where: { status: ServiceStatus.PUBLISHED } }),
      this.prisma.serviceProvider.count({ where: { status: ProviderStatus.PENDING } }),
      this.prisma.service.count({ where: { status: ServiceStatus.PENDING_APPROVAL } }),
      this.prisma.reservation.count(),
      this.prisma.reservation.count({
        where: { status: { in: ['confirmed', 'completed'] } },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'captured' },
        _sum: { amount: true },
      }),
      this.getMonthlyStats(6),
    ]);

    return {
      totalUsers,
      totalProviders,
      totalServices,
      publishedServices,
      pendingProviders,
      pendingServices,
      totalReservations,
      activeReservations,
      totalRevenue: totalRevenueRow._sum.amount ?? 0,
      monthly: monthlyStats,
    };
  }

  /**
   * Son N ay için aylık breakdown: rezervasyon sayısı + ciro.
   */
  private async getMonthlyStats(months: number) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    // Tüm ayları üretelim (içinde veri olmasa bile)
    const buckets: { year: number; month: number; label: string }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`,
      });
    }

    // Rezervasyon sayıları
    const reservations = await this.prisma.reservation.groupBy({
      by: ['createdAt'],
      _count: true,
      where: { createdAt: { gte: startDate } },
    });
    // Prisma SQLite'ta by: ['createdAt'] ile groupBy datetime'a göre yapılır ama
    // ay-bazlı gruplama SQL tarafında yapılamaz (strftime yok). Bunun yerine
    // tüm kayıtları çekip JS tarafında gruplayalım:
    const allReservations = await this.prisma.reservation.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true, totalPrice: true, status: true },
    });
    const allPayments = await this.prisma.payment.findMany({
      where: { createdAt: { gte: startDate }, status: 'captured' },
      select: { createdAt: true, amount: true, currency: true },
    });

    const monthMap: Record<string, { reservations: number; revenue: number }> = {};
    for (const b of buckets) {
      monthMap[`${b.year}-${b.month}`] = { reservations: 0, revenue: 0 };
    }
    for (const r of allReservations) {
      const key = `${r.createdAt.getFullYear()}-${r.createdAt.getMonth() + 1}`;
      if (monthMap[key]) {
        monthMap[key].reservations += 1;
      }
    }
    for (const p of allPayments) {
      const key = `${p.createdAt.getFullYear()}-${p.createdAt.getMonth() + 1}`;
      if (monthMap[key]) {
        monthMap[key].revenue += p.amount;
      }
    }

    return buckets.map((b) => ({
      label: b.label,
      year: b.year,
      month: b.month,
      reservations: monthMap[`${b.year}-${b.month}`].reservations,
      revenue: monthMap[`${b.year}-${b.month}`].revenue,
    }));
  }

  // ===========================================================================
  // USERS
  // ===========================================================================
  async listUsers(query: { page?: number; limit?: number; role?: string; status?: string; search?: string }) {
    const where: any = {};
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { email: { contains: query.search } },
        { fullName: { contains: query.search } },
        { phone: { contains: query.search } },
      ];
    }
    return paginate(
      this.prisma.user,
      {
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          provider: { select: { id: true, companyName: true, status: true } },
        },
      },
      { page: query.page, limit: query.limit },
    );
  }

  async updateUserStatus(userId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('Kullanıcı');
    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenError('Süper admin durumu değiştirilemez');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: dto.status },
      select: { id: true, email: true, role: true, status: true },
    });

    // Kullanıcı banlandıysa tüm refresh token'ları revoke edilir (auth servisi üzerinden)
    // — bu Faz 1'de in-memory store; controller/service'te tetiklenebilir.
    // Şimdilik notification düşüyoruz.
    if (dto.status === UserStatus.BANNED) {
      await this.notifications.notifyUser({
        userId,
        type: NotificationType.GENERIC,
        title: 'Hesabınız askıya alındı',
        message: 'Hesabınız platform yönetimi tarafından askıya alındı. Detaylar için destek ekibiyle iletişime geçin.',
      });
    } else if (dto.status === UserStatus.ACTIVE) {
      await this.notifications.notifyUser({
        userId,
        type: NotificationType.GENERIC,
        title: 'Hesabınız aktif edildi',
        message: 'Hesabınız tekrar aktif edildi. Tüm özelliklere erişebilirsiniz.',
      });
    }

    this.logger.log(`User ${userId} status → ${dto.status}`);
    return updated;
  }

  // ===========================================================================
  // PROVIDERS (onay/red)
  // ===========================================================================
  async listProviders(query: { page?: number; limit?: number; status?: string; search?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { companyName: { contains: query.search } },
        { taxNumber: { contains: query.search } },
        { phone: { contains: query.search } },
        { user: { email: { contains: query.search } } },
      ];
    }
    return paginate(
      this.prisma.serviceProvider,
      {
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, fullName: true, phone: true, status: true },
          },
        },
      },
      { page: query.page, limit: query.limit },
    );
  }

  async getProvider(id: string) {
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, phone: true, status: true, createdAt: true },
        },
        services: {
          select: { id: true, title: true, status: true, createdAt: true },
        },
      },
    });
    if (!provider) throw new NotFoundError('Sağlayıcı');
    return provider;
  }

  async approveProvider(id: string, dto: ApproveProviderDto) {
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!provider) throw new NotFoundError('Sağlayıcı');
    if (provider.status === ProviderStatus.APPROVED) {
      throw new BusinessError('Sağlayıcı zaten onaylı', ERROR_CODES.RESOURCE_CONFLICT, 409);
    }

    const updated = await this.prisma.serviceProvider.update({
      where: { id },
      data: { status: ProviderStatus.APPROVED },
      include: { user: true },
    });

    // User status'unu da active yap (eğer pending ise)
    if (provider.user.status === UserStatus.PENDING) {
      await this.prisma.user.update({
        where: { id: provider.userId },
        data: { status: UserStatus.ACTIVE },
      });
    }

    // Notification
    await this.notifications.notifyUser({
      userId: provider.userId,
      type: NotificationType.PROVIDER_APPROVED,
      title: 'Sağlayıcı başvurunuz onaylandı',
      message: `Tebrikler! "${provider.companyName}" sağlayıcı başvurunuz onaylandı. Artık hizmet oluşturabilirsiniz.${dto.note ? ' Ek not: ' + dto.note : ''}`,
    });

    this.logger.log(`Provider approved: ${id} (${provider.companyName})`);
    return updated;
  }

  async rejectProvider(id: string, dto: RejectProviderDto) {
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!provider) throw new NotFoundError('Sağlayıcı');
    if (provider.status === ProviderStatus.REJECTED) {
      throw new BusinessError('Sağlayıcı zaten reddedilmiş', ERROR_CODES.RESOURCE_CONFLICT, 409);
    }

    const updated = await this.prisma.serviceProvider.update({
      where: { id },
      data: { status: ProviderStatus.REJECTED },
      include: { user: true },
    });

    // Notification
    await this.notifications.notifyUser({
      userId: provider.userId,
      type: NotificationType.PROVIDER_REJECTED,
      title: 'Sağlayıcı başvurunuz reddedildi',
      message: `"${provider.companyName}" başvurunuz reddedildi. Gerekçe: ${dto.reason}`,
    });

    this.logger.log(`Provider rejected: ${id} (${provider.companyName}) — reason: ${dto.reason}`);
    return updated;
  }

  // ===========================================================================
  // SERVICES (onay/red)
  // ===========================================================================
  async listServices(query: { page?: number; limit?: number; status?: string; search?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
      ];
    }
    return paginate(
      this.prisma.service,
      {
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          provider: {
            select: { id: true, companyName: true, user: { select: { email: true } } },
          },
          category: { select: { id: true, name: true } },
          city: { select: { id: true, name: true } },
          images: { select: { id: true, imageUrl: true, isMain: true }, orderBy: { sortOrder: 'asc' } },
        },
      },
      { page: query.page, limit: query.limit },
    );
  }

  async getService(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        provider: {
          include: { user: { select: { id: true, email: true, fullName: true } } },
        },
        category: true,
        city: true,
        images: { orderBy: { sortOrder: 'asc' } },
        pricing: { where: { isActive: true } },
        schedules: { orderBy: { startAt: 'asc' } },
      },
    });
    if (!service) throw new NotFoundError('Hizmet');
    return service;
  }

  async approveService(id: string, dto: ApproveServiceDto) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { provider: true },
    });
    if (!service) throw new NotFoundError('Hizmet');
    if (service.status === ServiceStatus.PUBLISHED) {
      throw new BusinessError('Hizmet zaten yayında', ERROR_CODES.RESOURCE_CONFLICT, 409);
    }

    const updated = await this.prisma.service.update({
      where: { id },
      data: { status: ServiceStatus.PUBLISHED, rejectionReason: null },
      include: { provider: true },
    });

    // Sağlayıcıya notification
    await this.notifications.notifyProvider({
      providerId: service.providerId,
      type: NotificationType.SERVICE_APPROVED,
      title: 'Hizmetiniz onaylandı',
      message: `"${service.title}" hizmetiniz yayına alındı.${dto.note ? ' Ek not: ' + dto.note : ''}`,
    });

    this.logger.log(`Service approved: ${id} (${service.title})`);
    return updated;
  }

  async rejectService(id: string, dto: RejectServiceDto) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { provider: true },
    });
    if (!service) throw new NotFoundError('Hizmet');
    if (service.status === ServiceStatus.REJECTED) {
      throw new BusinessError('Hizmet zaten reddedilmiş', ERROR_CODES.RESOURCE_CONFLICT, 409);
    }

    const updated = await this.prisma.service.update({
      where: { id },
      data: {
        status: ServiceStatus.REJECTED,
        rejectionReason: dto.reason,
      },
      include: { provider: true },
    });

    await this.notifications.notifyProvider({
      providerId: service.providerId,
      type: NotificationType.SERVICE_REJECTED,
      title: 'Hizmetiniz reddedildi',
      message: `"${service.title}" hizmetiniz reddedildi. Gerekçe: ${dto.reason}`,
    });

    this.logger.log(`Service rejected: ${id} (${service.title}) — reason: ${dto.reason}`);
    return updated;
  }

  // ===========================================================================
  // CATEGORIES
  // ===========================================================================
  async listCategories() {
    return this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { services: true } } },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const slug = this.slugify(dto.name);
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) throw new ConflictError('Bu isimde kategori zaten mevcut');

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        iconName: dto.iconName,
        sortOrder: dto.sortOrder ?? 0,
        isActive: true,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { services: true } } },
    });
    if (!category) throw new NotFoundError('Kategori');

    // Pasife alma kuralı: aktif hizmeti varsa izin verme
    if (dto.isActive === false) {
      const activeServicesCount = await this.prisma.service.count({
        where: {
          categoryId: id,
          status: { in: [ServiceStatus.PUBLISHED, ServiceStatus.PENDING_APPROVAL] },
        },
      });
      if (activeServicesCount > 0) {
        throw new BusinessError(
          `Bu kategoride ${activeServicesCount} aktif/yayında hizmet var. Önce hizmetleri durdurun veya başka kategoriye taşıyın.`,
          ERROR_CODES.RESOURCE_CONFLICT,
          409,
        );
      }
    }

    let newSlug = category.slug;
    if (dto.name && dto.name !== category.name) {
      newSlug = this.slugify(dto.name);
      const existing = await this.prisma.category.findUnique({ where: { slug: newSlug } });
      if (existing && existing.id !== id) {
        throw new ConflictError('Bu isim başka bir kategori tarafından kullanılıyor');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name, slug: newSlug } : {}),
        ...(dto.iconName !== undefined ? { iconName: dto.iconName } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { services: true } } },
    });
    if (!category) throw new NotFoundError('Kategori');

    // Hizmet varsa silme
    const servicesCount = await this.prisma.service.count({ where: { categoryId: id } });
    if (servicesCount > 0) {
      throw new BusinessError(
        `Bu kategoriye ait ${servicesCount} hizmet var. Kategori silinemez — önce hizmetleri taşıyın veya silin.`,
        ERROR_CODES.RESOURCE_CONFLICT,
        409,
      );
    }

    return this.prisma.category.delete({ where: { id } });
  }

  // ===========================================================================
  // CITIES
  // ===========================================================================
  async listCities() {
    return this.prisma.city.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { services: true } } },
    });
  }

  async createCity(dto: CreateCityDto) {
    const slug = this.slugify(dto.name);
    const existing = await this.prisma.city.findUnique({ where: { slug } });
    if (existing) throw new ConflictError('Bu isimde şehir zaten mevcut');
    return this.prisma.city.create({ data: { name: dto.name, slug, isActive: true } });
  }

  async updateCity(id: string, dto: UpdateCityDto) {
    const city = await this.prisma.city.findUnique({ where: { id } });
    if (!city) throw new NotFoundError('Şehir');

    let newSlug = city.slug;
    if (dto.name && dto.name !== city.name) {
      newSlug = this.slugify(dto.name);
      const existing = await this.prisma.city.findUnique({ where: { slug: newSlug } });
      if (existing && existing.id !== id) {
        throw new ConflictError('Bu isim başka bir şehir tarafından kullanılıyor');
      }
    }

    return this.prisma.city.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name, slug: newSlug } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteCity(id: string) {
    const city = await this.prisma.city.findUnique({ where: { id } });
    if (!city) throw new NotFoundError('Şehir');

    const servicesCount = await this.prisma.service.count({ where: { cityId: id } });
    if (servicesCount > 0) {
      throw new BusinessError(
        `Bu şehirde ${servicesCount} hizmet var. Şehir silinemez.`,
        ERROR_CODES.RESOURCE_CONFLICT,
        409,
      );
    }
    return this.prisma.city.delete({ where: { id } });
  }

  // ===========================================================================
  // SETTINGS
  // ===========================================================================
  async getSettings() {
    const settings = await this.prisma.setting.findMany();
    // value String olarak tutuluyor; JSON parse et
    const result: Record<string, any> = {};
    for (const s of settings) {
      try {
        result[s.key] = JSON.parse(s.value);
      } catch {
        result[s.key] = s.value;
      }
    }
    return result;
  }

  async updateSetting(key: string, value: any) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    return this.prisma.setting.upsert({
      where: { key },
      update: { value: stringValue },
      create: { key, value: stringValue },
    });
  }

  // ===========================================================================
  // RESERVATIONS (read-only)
  // ===========================================================================
  async listReservations(query: { page?: number; limit?: number; status?: string; search?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { reservationCode: { contains: query.search } },
        { contactName: { contains: query.search } },
        { contactEmail: { contains: query.search } },
      ];
    }
    return paginate(
      this.prisma.reservation,
      {
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          service: { select: { id: true, title: true } },
          schedule: { select: { id: true, startAt: true, endAt: true } },
          payments: { select: { id: true, amount: true, status: true, provider: true } },
        },
      },
      { page: query.page, limit: query.limit },
    );
  }

  // ===========================================================================
  // PAYMENTS (read-only)
  // ===========================================================================
  async listPayments(query: { page?: number; limit?: number; status?: string; search?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { providerTransactionId: { contains: query.search } },
        { reservation: { reservationCode: { contains: query.search } } },
      ];
    }
    return paginate(
      this.prisma.payment,
      {
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          reservation: {
            select: {
              id: true,
              reservationCode: true,
              user: { select: { email: true } },
              service: { select: { title: true } },
            },
          },
          refunds: true,
        },
      },
      { page: query.page, limit: query.limit },
    );
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================
  private slugify(s: string): string {
    return s
      .toLowerCase()
      .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

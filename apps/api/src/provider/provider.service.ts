import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ProviderStatus,
  ServiceStatus,
  UserRole,
  UserStatus,
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
import {
  CreateServiceDto,
  UpdateServiceDto,
  AddServiceImageDto,
  UpdateServiceImageDto,
  CreatePricingDto,
  UpdatePricingDto,
  CreateScheduleDto,
  UpdateScheduleDto,
  BulkCreateSchedulesDto,
  CancelReservationDto,
  UpdateProviderProfileDto,
} from './dto';

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // --------------------------------------------------------------------------
  // PROFILE
  // --------------------------------------------------------------------------
  async getProfile(userId: string) {
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { userId },
      include: { user: { select: { email: true, fullName: true, phone: true } } },
    });
    if (!provider) throw new NotFoundError('Sağlayıcı');
    return provider;
  }

  async updateProfile(userId: string, dto: UpdateProviderProfileDto) {
    const provider = await this.prisma.serviceProvider.findUnique({ where: { userId } });
    if (!provider) throw new NotFoundError('Sağlayıcı');

    return this.prisma.serviceProvider.update({
      where: { userId },
      data: {
        ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
      },
      include: { user: { select: { email: true, fullName: true, phone: true } } },
    });
  }

  // --------------------------------------------------------------------------
  // DASHBOARD STATS
  // --------------------------------------------------------------------------
  async getDashboardStats(userId: string) {
    const provider = await this.requireProvider(userId);
    const [draft, pending, published, rejected, paused, reservationsActive] = await Promise.all([
      this.prisma.service.count({ where: { providerId: provider.id, status: ServiceStatus.DRAFT } }),
      this.prisma.service.count({ where: { providerId: provider.id, status: ServiceStatus.PENDING_APPROVAL } }),
      this.prisma.service.count({ where: { providerId: provider.id, status: ServiceStatus.PUBLISHED } }),
      this.prisma.service.count({ where: { providerId: provider.id, status: ServiceStatus.REJECTED } }),
      this.prisma.service.count({ where: { providerId: provider.id, status: ServiceStatus.PAUSED } }),
      this.prisma.reservation.count({
        where: {
          service: { providerId: provider.id },
          status: { in: ['pending_payment', 'confirmed'] },
        },
      }),
    ]);
    return {
      services: { draft, pending, published, rejected, paused, total: draft + pending + published + rejected + paused },
      activeReservations: reservationsActive,
    };
  }

  // --------------------------------------------------------------------------
  // SERVICES (CRUD)
  // --------------------------------------------------------------------------
  async listServices(userId: string, query: { page?: number; limit?: number; status?: string; search?: string }) {
    const provider = await this.requireProvider(userId);
    const where: any = { providerId: provider.id };
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
        orderBy: { updatedAt: 'desc' },
        include: {
          category: { select: { name: true, slug: true } },
          city: { select: { name: true, slug: true } },
          images: { where: { isMain: true }, take: 1 },
          _count: { select: { reservations: true } },
        },
      },
      { page: query.page, limit: query.limit },
    );
  }

  async getService(userId: string, serviceId: string) {
    const provider = await this.requireProvider(userId);
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        category: true,
        city: true,
        images: { orderBy: { sortOrder: 'asc' } },
        pricing: { orderBy: { price: 'asc' } },
        schedules: { orderBy: { startAt: 'asc' } },
      },
    });
    if (!service) throw new NotFoundError('Hizmet');
    if (service.providerId !== provider.id) {
      throw new ForbiddenError('Bu hizmete erişim yetkiniz yok', ERROR_CODES.OWNERSHIP_VIOLATION);
    }
    return service;
  }

  /**
   * Step 1: Create service (draft olarak başlar)
   */
  async createService(userId: string, dto: CreateServiceDto) {
    const provider = await this.requireProvider(userId);

    // Kategori ve şehir var mı?
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundError('Kategori');
    const city = await this.prisma.city.findUnique({ where: { id: dto.cityId } });
    if (!city) throw new NotFoundError('Şehir');

    const slug = await this.uniqueSlug(dto.title);

    const service = await this.prisma.service.create({
      data: {
        providerId: provider.id,
        categoryId: dto.categoryId,
        cityId: dto.cityId,
        title: dto.title,
        slug,
        description: dto.description,
        meetingPoint: dto.meetingPoint,
        latitude: dto.latitude,
        longitude: dto.longitude,
        durationHours: dto.durationHours,
        status: ServiceStatus.DRAFT,
      },
      include: {
        category: { select: { name: true, slug: true } },
        city: { select: { name: true, slug: true } },
      },
    });
    this.logger.log(`Service created (draft): ${service.id} by provider ${provider.id}`);
    return service;
  }

  async updateService(userId: string, serviceId: string, dto: UpdateServiceDto) {
    const service = await this.getService(userId, serviceId);

    // Sadece taslak veya reddedilmiş hizmetler düzenlenebilir
    if (service.status === ServiceStatus.PUBLISHED || service.status === ServiceStatus.PENDING_APPROVAL) {
      throw new BusinessError(
        'Yayında veya onay bekleyen hizmet düzenlenemez. Önce durdurun.',
        ERROR_CODES.RESOURCE_CONFLICT,
        409,
      );
    }

    let newSlug = service.slug;
    if (dto.title && dto.title !== service.title) {
      newSlug = await this.uniqueSlug(dto.title, service.id);
    }

    if (dto.categoryId && dto.categoryId !== service.categoryId) {
      const cat = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!cat) throw new NotFoundError('Kategori');
    }
    if (dto.cityId && dto.cityId !== service.cityId) {
      const c = await this.prisma.city.findUnique({ where: { id: dto.cityId } });
      if (!c) throw new NotFoundError('Şehir');
    }

    return this.prisma.service.update({
      where: { id: serviceId },
      data: {
        ...(dto.title ? { title: dto.title, slug: newSlug } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
        ...(dto.cityId ? { cityId: dto.cityId } : {}),
        ...(dto.meetingPoint !== undefined ? { meetingPoint: dto.meetingPoint } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.durationHours !== undefined ? { durationHours: dto.durationHours } : {}),
        // Edit sonrası rejectionReason temizlenir
        rejectionReason: null,
      },
      include: {
        category: { select: { name: true, slug: true } },
        city: { select: { name: true, slug: true } },
      },
    });
  }

  /**
   * Step 5: Onaya gönder. Validasyon: başlık+dolu, en az 1 görsel, en az 1 fiyat, en az 1 gelecek slot.
   */
  async submitForApproval(userId: string, serviceId: string) {
    const service = await this.getService(userId, serviceId);

    if (service.status !== ServiceStatus.DRAFT && service.status !== ServiceStatus.REJECTED) {
      throw new BusinessError(
        'Yalnızca taslak veya reddedilmiş hizmetler onaya gönderilebilir',
        ERROR_CODES.RESOURCE_CONFLICT,
        409,
      );
    }

    // Validasyon
    if (!service.title || service.title.length < 3) {
      throw new BusinessError('Başlık en az 3 karakter olmalı', ERROR_CODES.VALIDATION_FAILED, 422);
    }
    if (!service.description || service.description.length < 10) {
      throw new BusinessError('Açıklama en az 10 karakter olmalı', ERROR_CODES.VALIDATION_FAILED, 422);
    }
    if (!service.images || service.images.length === 0) {
      throw new BusinessError('En az bir görsel eklemelisiniz', ERROR_CODES.VALIDATION_FAILED, 422);
    }
    const hasMainImage = service.images.some((i: any) => i.isMain);
    if (!hasMainImage) {
      throw new BusinessError('Bir ana görsel seçmelisiniz', ERROR_CODES.VALIDATION_FAILED, 422);
    }
    const activePricing = service.pricing?.filter((p: any) => p.isActive);
    if (!activePricing || activePricing.length === 0) {
      throw new BusinessError('En az bir aktif fiyat varyantı eklemelisiniz', ERROR_CODES.VALIDATION_FAILED, 422);
    }
    const futureSchedules = service.schedules?.filter((s: any) => new Date(s.startAt) > new Date() && s.status === 'open');
    if (!futureSchedules || futureSchedules.length === 0) {
      throw new BusinessError('En az bir gelecek tarihli açık takvim slotu olmalı', ERROR_CODES.VALIDATION_FAILED, 422);
    }

    const updated = await this.prisma.service.update({
      where: { id: serviceId },
      data: { status: ServiceStatus.PENDING_APPROVAL, rejectionReason: null },
    });
    this.logger.log(`Service submitted for approval: ${serviceId}`);
    return updated;
  }

  async deleteService(userId: string, serviceId: string) {
    const service = await this.getService(userId, serviceId);

    // Aktif rezervasyonu varsa silme
    const activeReservations = await this.prisma.reservation.count({
      where: {
        serviceId,
        status: { in: ['pending_payment', 'confirmed'] },
      },
    });
    if (activeReservations > 0) {
      throw new BusinessError(
        `Bu hizmete ${activeReservations} aktif rezervasyon var. Silinemez.`,
        ERROR_CODES.RESOURCE_CONFLICT,
        409,
      );
    }

    return this.prisma.service.delete({ where: { id: serviceId } });
  }

  // --------------------------------------------------------------------------
  // IMAGES (Step 2)
  // --------------------------------------------------------------------------
  async addImage(userId: string, serviceId: string, dto: AddServiceImageDto) {
    const service = await this.getService(userId, serviceId);

    // Eğer isMain=true ise, diğerlerini unmain yap
    if (dto.isMain) {
      await this.prisma.serviceImage.updateMany({
        where: { serviceId },
        data: { isMain: false },
      });
    }

    const sortOrder = dto.sortOrder ?? (await this.prisma.serviceImage.count({ where: { serviceId } }));

    const image = await this.prisma.serviceImage.create({
      data: {
        serviceId,
        imageUrl: dto.imageUrl,
        sortOrder,
        isMain: dto.isMain ?? false,
      },
    });

    // İlk görsel otomatik ana görsel olsun
    const total = await this.prisma.serviceImage.count({ where: { serviceId } });
    if (total === 1) {
      await this.prisma.serviceImage.update({ where: { id: image.id }, data: { isMain: true } });
      image.isMain = true;
    }

    return image;
  }

  async updateImage(userId: string, serviceId: string, imageId: string, dto: UpdateServiceImageDto) {
    const service = await this.getService(userId, serviceId);
    const image = await this.prisma.serviceImage.findFirst({
      where: { id: imageId, serviceId },
    });
    if (!image) throw new NotFoundError('Görsel');

    if (dto.isMain === true) {
      await this.prisma.serviceImage.updateMany({
        where: { serviceId },
        data: { isMain: false },
      });
    }

    return this.prisma.serviceImage.update({
      where: { id: imageId },
      data: {
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isMain !== undefined ? { isMain: dto.isMain } : {}),
      },
    });
  }

  async deleteImage(userId: string, serviceId: string, imageId: string) {
    const service = await this.getService(userId, serviceId);
    const image = await this.prisma.serviceImage.findFirst({
      where: { id: imageId, serviceId },
    });
    if (!image) throw new NotFoundError('Görsel');

    await this.prisma.serviceImage.delete({ where: { id: imageId } });

    // Eğer silinen ana görselse, ilk kalanı ana yap
    if (image.isMain) {
      const next = await this.prisma.serviceImage.findFirst({
        where: { serviceId },
        orderBy: { sortOrder: 'asc' },
      });
      if (next) {
        await this.prisma.serviceImage.update({ where: { id: next.id }, data: { isMain: true } });
      }
    }
    return { deleted: true, id: imageId };
  }

  // --------------------------------------------------------------------------
  // PRICING (Step 3)
  // --------------------------------------------------------------------------
  async listPricing(userId: string, serviceId: string) {
    await this.getService(userId, serviceId);
    return this.prisma.servicePricing.findMany({
      where: { serviceId },
      orderBy: { price: 'asc' },
    });
  }

  async addPricing(userId: string, serviceId: string, dto: CreatePricingDto) {
    await this.getService(userId, serviceId);
    return this.prisma.servicePricing.create({
      data: {
        serviceId,
        name: dto.name,
        price: dto.price,
        currency: dto.currency || 'TRY',
        unit: dto.unit,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updatePricing(userId: string, serviceId: string, pricingId: string, dto: UpdatePricingDto) {
    await this.getService(userId, serviceId);
    const pricing = await this.prisma.servicePricing.findFirst({
      where: { id: pricingId, serviceId },
    });
    if (!pricing) throw new NotFoundError('Fiyat varyantı');

    return this.prisma.servicePricing.update({
      where: { id: pricingId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deletePricing(userId: string, serviceId: string, pricingId: string) {
    await this.getService(userId, serviceId);
    const pricing = await this.prisma.servicePricing.findFirst({
      where: { id: pricingId, serviceId },
    });
    if (!pricing) throw new NotFoundError('Fiyat varyantı');

    // Rezerve edilmiş pricing silinemez
    const used = await this.prisma.reservation.count({ where: { pricingId } });
    if (used > 0) {
      throw new BusinessError(
        `Bu fiyat varyantına ${used} rezervasyon bağlı. Silinemez.`,
        ERROR_CODES.RESOURCE_CONFLICT,
        409,
      );
    }
    await this.prisma.servicePricing.delete({ where: { id: pricingId } });
    return { deleted: true, id: pricingId };
  }

  // --------------------------------------------------------------------------
  // SCHEDULES (Step 4)
  // --------------------------------------------------------------------------
  async listSchedules(userId: string, serviceId: string) {
    await this.getService(userId, serviceId);
    return this.prisma.serviceSchedule.findMany({
      where: { serviceId },
      orderBy: { startAt: 'asc' },
    });
  }

  async addSchedule(userId: string, serviceId: string, dto: CreateScheduleDto) {
    await this.getService(userId, serviceId);
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (endAt <= startAt) {
      throw new BusinessError('Bitiş zamanı başlangıçtan sonra olmalı', ERROR_CODES.VALIDATION_FAILED, 422);
    }
    return this.prisma.serviceSchedule.create({
      data: {
        serviceId,
        startAt,
        endAt,
        capacity: dto.capacity,
        status: dto.status || 'open',
      },
    });
  }

  async bulkAddSchedules(userId: string, serviceId: string, dto: BulkCreateSchedulesDto) {
    await this.getService(userId, serviceId);
    const startDate = new Date(dto.startDate + 'T00:00:00');
    const endDate = new Date(dto.endDate + 'T00:00:00');
    if (endDate < startDate) {
      throw new BusinessError('Bitiş tarihi başlangıçtan önce olamaz', ERROR_CODES.VALIDATION_FAILED, 422);
    }
    const weekdays = dto.weekdays || [0, 1, 2, 3, 4, 5, 6];

    const slots: any[] = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      if (weekdays.includes(cursor.getDay())) {
        const dateStr = cursor.toISOString().slice(0, 10);
        const startAt = new Date(`${dateStr}T${dto.startTime}:00`);
        const endAt = new Date(`${dateStr}T${dto.endTime}:00`);
        // Geçmiş tarih atla
        if (startAt > new Date()) {
          slots.push({
            serviceId,
            startAt,
            endAt,
            capacity: dto.capacity,
            status: 'open',
          });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (slots.length === 0) {
      throw new BusinessError('Verilen aralıkta hiç geçerli slot yok', ERROR_CODES.VALIDATION_FAILED, 422);
    }

    const result = await this.prisma.serviceSchedule.createMany({ data: slots });
    this.logger.log(`Bulk schedules created: ${result.count} slots for service ${serviceId}`);
    return { created: result.count };
  }

  async updateSchedule(userId: string, serviceId: string, scheduleId: string, dto: UpdateScheduleDto) {
    await this.getService(userId, serviceId);
    const schedule = await this.prisma.serviceSchedule.findFirst({
      where: { id: scheduleId, serviceId },
    });
    if (!schedule) throw new NotFoundError('Takvim slotu');

    // Rezervasyonu varsa capacity düşürülemez
    if (dto.capacity !== undefined && dto.capacity < schedule.bookedCount) {
      throw new BusinessError(
        `Kapasite ${schedule.bookedCount} rezervasyondan az olamaz`,
        ERROR_CODES.RESOURCE_CONFLICT,
        409,
      );
    }

    const data: any = {};
    if (dto.startAt) data.startAt = new Date(dto.startAt);
    if (dto.endAt) data.endAt = new Date(dto.endAt);
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.serviceSchedule.update({ where: { id: scheduleId }, data });
  }

  async deleteSchedule(userId: string, serviceId: string, scheduleId: string) {
    await this.getService(userId, serviceId);
    const schedule = await this.prisma.serviceSchedule.findFirst({
      where: { id: scheduleId, serviceId },
    });
    if (!schedule) throw new NotFoundError('Takvim slotu');

    if (schedule.bookedCount > 0) {
      throw new BusinessError(
        `Bu slot'a ${schedule.bookedCount} rezervasyon var. Silinemez.`,
        ERROR_CODES.RESOURCE_CONFLICT,
        409,
      );
    }
    await this.prisma.serviceSchedule.delete({ where: { id: scheduleId } });
    return { deleted: true, id: scheduleId };
  }

  // --------------------------------------------------------------------------
  // RESERVATIONS (provider view)
  // --------------------------------------------------------------------------
  async listReservations(
    userId: string,
    query: { page?: number; limit?: number; status?: string; search?: string },
  ) {
    const provider = await this.requireProvider(userId);
    const where: any = {
      service: { providerId: provider.id },
    };
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
          user: { select: { email: true, fullName: true } },
          service: { select: { id: true, title: true } },
          schedule: { select: { startAt: true, endAt: true } },
          pricing: { select: { name: true, unit: true } },
          payments: { select: { amount: true, status: true, provider: true } },
        },
      },
      { page: query.page, limit: query.limit },
    );
  }

  async confirmReservation(userId: string, reservationId: string) {
    const provider = await this.requireProvider(userId);
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { service: true, schedule: true },
    });
    if (!reservation) throw new NotFoundError('Rezervasyon');
    if (reservation.service.providerId !== provider.id) {
      throw new ForbiddenError('Bu rezervasyona erişim yetkiniz yok', ERROR_CODES.OWNERSHIP_VIOLATION);
    }

    if (reservation.status !== 'pending_payment' && reservation.status !== 'confirmed') {
      throw new BusinessError(
        'Yalnızca ödeme bekleyen veya onaylı rezervasyonlar onaylanabilir',
        ERROR_CODES.RESOURCE_CONFLICT,
        409,
      );
    }

    const updated = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: 'confirmed' },
    });

    // Kapasiteyi artır
    await this.prisma.serviceSchedule.update({
      where: { id: reservation.scheduleId },
      data: { bookedCount: { increment: reservation.participantCount } },
    });

    // Bildirim
    await this.notifications.notifyUser({
      userId: reservation.userId,
      type: NotificationType.RESERVATION_CONFIRMED,
      title: 'Rezervasyonunuz onaylandı',
      message: `"${reservation.service.title}" rezervasyonunuz sağlayıcı tarafından onaylandı.`,
    });

    return updated;
  }

  async cancelReservation(userId: string, reservationId: string, dto: CancelReservationDto) {
    const provider = await this.requireProvider(userId);
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { service: true, schedule: true },
    });
    if (!reservation) throw new NotFoundError('Rezervasyon');
    if (reservation.service.providerId !== provider.id) {
      throw new ForbiddenError('Bu rezervasyona erişim yetkiniz yok', ERROR_CODES.OWNERSHIP_VIOLATION);
    }

    if (reservation.status !== 'pending_payment' && reservation.status !== 'confirmed') {
      throw new BusinessError(
        'Bu rezervasyon iptal edilemez (durum: ' + reservation.status + ')',
        ERROR_CODES.RESOURCE_CONFLICT,
        409,
      );
    }

    const updated = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: 'cancelled', cancellationReason: dto.reason },
    });

    // Kapasiteyi geri al
    if (reservation.status === 'confirmed') {
      await this.prisma.serviceSchedule.update({
        where: { id: reservation.scheduleId },
        data: { bookedCount: { decrement: reservation.participantCount } },
      });
    }

    await this.notifications.notifyUser({
      userId: reservation.userId,
      type: NotificationType.RESERVATION_CANCELLED,
      title: 'Rezervasyonunuz iptal edildi',
      message: `"${reservation.service.title}" rezervasyonunuz iptal edildi. Gerekçe: ${dto.reason}`,
    });

    return updated;
  }

  // --------------------------------------------------------------------------
  // EARNINGS
  // --------------------------------------------------------------------------
  async getEarnings(userId: string, query: { from?: string; to?: string }) {
    const provider = await this.requireProvider(userId);
    const now = new Date();

    // Bu ay
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    // Geçen ay
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const commissionRate = await this.getCommissionRate();

    const [thisMonthData, lastMonthData] = await Promise.all([
      this.computeEarnings(provider.id, thisMonthStart, thisMonthEnd, commissionRate),
      this.computeEarnings(provider.id, lastMonthStart, lastMonthEnd, commissionRate),
    ]);

    // Tüm zamanlar (opsiyonel from/to)
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const totalData = await this.computeEarnings(provider.id, from, to, commissionRate);

    return {
      thisMonth: thisMonthData,
      lastMonth: lastMonthData,
      total: totalData,
      commissionRate,
    };
  }

  private async computeEarnings(providerId: string, from: Date | undefined, to: Date | undefined, commissionRate: number) {
    const where: any = {
      service: { providerId },
      status: 'completed',
    };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }
    const reservations = await this.prisma.reservation.findMany({
      where,
      select: {
        id: true,
        totalPrice: true,
        discountAmount: true,
        status: true,
        createdAt: true,
        service: { select: { id: true, title: true } },
      },
    });
    const gross = reservations.reduce((s, r) => s + r.totalPrice, 0);
    const commission = gross * commissionRate;
    const net = gross - commission;
    return {
      reservationCount: reservations.length,
      grossRevenue: gross,
      commission,
      netEarnings: net,
      byService: this.groupByService(reservations, commissionRate),
    };
  }

  private groupByService(reservations: any[], commissionRate: number) {
    const map: Record<string, { serviceId: string; serviceTitle: string; count: number; revenue: number; net: number }> = {};
    for (const r of reservations) {
      const k = r.service.id;
      if (!map[k]) {
        map[k] = { serviceId: r.service.id, serviceTitle: r.service.title, count: 0, revenue: 0, net: 0 };
      }
      map[k].count++;
      map[k].revenue += r.totalPrice;
      map[k].net = map[k].revenue * (1 - commissionRate);
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }

  private async getCommissionRate(): Promise<number> {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'commission_rate' } });
    if (!setting) return 0.10;
    try {
      return JSON.parse(setting.value);
    } catch {
      return 0.10;
    }
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------
  async requireProvider(userId: string) {
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { userId },
      include: { user: { select: { status: true, role: true } } },
    });
    if (!provider) {
      throw new NotFoundError('Sağlayıcı kaydı');
    }
    // Sadece approved sağlayıcı service yönetebilir
    if (provider.status !== ProviderStatus.APPROVED) {
      throw new ForbiddenError(
        `Sağlayıcı başvurunuz ${provider.status} durumunda. Hizmet oluşturmak için onaylanmış olmalısınız.`,
        ERROR_CODES.ROLE_FORBIDDEN,
      );
    }
    if (provider.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('Hesabınız aktif değil', ERROR_CODES.ROLE_FORBIDDEN);
    }
    return provider;
  }

  /**
   * Slug'ı benzersiz yap — çakışırsa kısa hash ekle.
   */
  private async uniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = this.slugify(title);
    let slug = base;
    let attempt = 0;
    while (attempt < 20) {
      const existing = await this.prisma.service.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing || (excludeId && existing.id === excludeId)) return slug;
      attempt++;
      slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    }
    return `${base}-${Date.now()}`;
  }

  private slugify(s: string): string {
    return s
      .toLowerCase()
      .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 280);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationStatus, ReviewStatus, ERROR_CODES } from '@turizm-pazaryeri/shared';
import { NotFoundError, ForbiddenError, BusinessError, ConflictError, paginate } from '../common';
import { CreateReviewDto, RejectReviewDto, ReviewListQueryDto } from './dto';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private prisma: PrismaService) {}

  // --------------------------------------------------------------------------
  // CREATE — sadece completed rezervasyonu olan kullanıcılar yorum yapabilir
  // --------------------------------------------------------------------------
  async createReview(userId: string, serviceId: string, dto: CreateReviewDto) {
    // 1. Hizmet var mı + published mı
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundError('Hizmet');
    if (service.status !== 'published') {
      throw new BusinessError('Yalnızca yayında olan hizmetlere yorum yapılabilir', ERROR_CODES.RESOURCE_CONFLICT, 409);
    }

    // 2. Kullanıcının bu hizmette COMPLETED rezervasyonu var mı?
    const completedReservation = await this.prisma.reservation.findFirst({
      where: {
        userId,
        serviceId,
        status: ReservationStatus.COMPLETED,
      },
      select: { id: true },
    });
    if (!completedReservation) {
      throw new ForbiddenError(
        'Bu hizmete yorum yapabilmek için tamamlanmış bir rezervasyonunuz olmalı',
        ERROR_CODES.ROLE_FORBIDDEN,
      );
    }

    // 3. Aynı hizmete daha önce yorum yapmış mı? (unique constraint)
    const existing = await this.prisma.review.findUnique({
      where: { userId_serviceId: { userId, serviceId } },
    });
    if (existing) {
      throw new ConflictError('Bu hizmete zaten yorum yaptınız', ERROR_CODES.RESOURCE_ALREADY_EXISTS);
    }

    // 4. Review oluştur (pending status)
    const review = await this.prisma.review.create({
      data: {
        serviceId,
        userId,
        reservationId: completedReservation.id,
        rating: dto.rating,
        comment: dto.comment,
        status: ReviewStatus.PENDING,
      },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    });

    this.logger.log(`Review created (pending): service=${serviceId} user=${userId} rating=${dto.rating}`);
    return review;
  }

  // --------------------------------------------------------------------------
  // LIST — public, yalnızca approved yorumlar
  // --------------------------------------------------------------------------
  async listPublicReviews(serviceId: string, query: ReviewListQueryDto) {
    const where = { serviceId, status: ReviewStatus.APPROVED };
    let orderBy: any = { createdAt: 'desc' };
    if (query.sort === 'highest') orderBy = { rating: 'desc' };
    else if (query.sort === 'lowest') orderBy = { rating: 'asc' };

    const result = await paginate(
      this.prisma.review,
      {
        where,
        orderBy,
        include: {
          user: { select: { id: true, fullName: true } },
        },
      },
      { page: query.page, limit: query.limit },
    );

    // Puan dağılımı (1-5 yıldız sayıları)
    const distribution = await this.computeRatingDistribution(serviceId);

    // Özet (avg + count cached'den)
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { avgRating: true, reviewCount: true },
    });

    return {
      ...result,
      summary: {
        avgRating: service?.avgRating ?? null,
        reviewCount: service?.reviewCount ?? 0,
        distribution,
      },
    };
  }

  // --------------------------------------------------------------------------
  // ADMIN: list pending/all reviews
  // --------------------------------------------------------------------------
  async listForAdmin(query: { page?: number; limit?: number; status?: string; serviceId?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.serviceId) where.serviceId = query.serviceId;

    return paginate(
      this.prisma.review,
      {
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          service: { select: { id: true, title: true, slug: true } },
          user: { select: { id: true, fullName: true, email: true } },
          reservation: { select: { reservationCode: true } },
        },
      },
      { page: query.page, limit: query.limit },
    );
  }

  // --------------------------------------------------------------------------
  // ADMIN: approve review → service.avgRating + reviewCount yeniden hesapla
  // --------------------------------------------------------------------------
  async approveReview(reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { service: true },
    });
    if (!review) throw new NotFoundError('Yorum');
    if (review.status === ReviewStatus.APPROVED) {
      throw new BusinessError('Yorum zaten onaylı', ERROR_CODES.RESOURCE_CONFLICT, 409);
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        status: ReviewStatus.APPROVED,
        rejectionReason: null,
      },
    });

    // Service cache güncelle
    await this.recomputeServiceRating(review.serviceId);

    this.logger.log(`Review approved: ${reviewId} (service=${review.serviceId})`);
    return updated;
  }

  // --------------------------------------------------------------------------
  // ADMIN: reject review → cache'i yeniden hesapla (zaten pending idi, değişmez)
  // --------------------------------------------------------------------------
  async rejectReview(reviewId: string, dto: RejectReviewDto) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundError('Yorum');
    if (review.status === ReviewStatus.REJECTED) {
      throw new BusinessError('Yorum zaten reddedilmiş', ERROR_CODES.RESOURCE_CONFLICT, 409);
    }
    // Eğer onaylanmış bir yorum reddediliyorsa, avgRating'i yeniden hesapla
    const wasApproved = review.status === ReviewStatus.APPROVED;

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        status: ReviewStatus.REJECTED,
        rejectionReason: dto.reason,
      },
    });

    if (wasApproved) {
      await this.recomputeServiceRating(review.serviceId);
    }

    this.logger.log(`Review rejected: ${reviewId} (reason: ${dto.reason})`);
    return updated;
  }

  // --------------------------------------------------------------------------
  // USER: kendi yorumlarını listele (her durumda)
  // --------------------------------------------------------------------------
  async listMyReviews(userId: string, query: { page?: number; limit?: number }) {
    return paginate(
      this.prisma.review,
      {
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          service: { select: { id: true, title: true, slug: true, images: { where: { isMain: true }, take: 1 } } },
        },
      },
      { page: query.page, limit: query.limit },
    );
  }

  // --------------------------------------------------------------------------
  // USER: kendi yorumunu sil (yalnızca pending/rejected, approved silinemez)
  // --------------------------------------------------------------------------
  async deleteMyReview(userId: string, reviewId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundError('Yorum');
    if (review.userId !== userId) {
      throw new ForbiddenError('Bu yoruma erişim yetkiniz yok', ERROR_CODES.OWNERSHIP_VIOLATION);
    }
    if (review.status === ReviewStatus.APPROVED) {
      throw new BusinessError(
        'Onaylanmış yorum silinemez. Düzenleme için destek ekibiyle iletişime geçin.',
        ERROR_CODES.RESOURCE_CONFLICT,
        409,
      );
    }

    await this.prisma.review.delete({ where: { id: reviewId } });
    return { deleted: true, id: reviewId };
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------
  /**
   * Bir hizmetin avgRating + reviewCount alanlarını approved yorumlara göre yeniden hesaplar.
   * Transaction içinde: aggregate + update.
   */
  async recomputeServiceRating(serviceId: string) {
    const aggregate = await this.prisma.review.aggregate({
      where: { serviceId, status: ReviewStatus.APPROVED },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const avgRating = aggregate._avg.rating ?? null;
    const reviewCount = aggregate._count.rating ?? 0;

    await this.prisma.service.update({
      where: { id: serviceId },
      data: { avgRating, reviewCount },
    });

    this.logger.log(`Service rating recomputed: ${serviceId} avg=${avgRating ?? 'null'} count=${reviewCount}`);
  }

  /**
   * Puan dağılımı: 1-5 yıldız, her birinin sayısı.
   * Yalnızca approved yorumlar.
   */
  private async computeRatingDistribution(serviceId: string): Promise<Record<number, number>> {
    const result: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const groups = await this.prisma.review.groupBy({
      by: ['rating'],
      _count: { rating: true },
      where: { serviceId, status: ReviewStatus.APPROVED },
    });
    for (const g of groups) {
      if (g.rating >= 1 && g.rating <= 5) {
        result[g.rating] = g._count.rating;
      }
    }
    return result;
  }
}

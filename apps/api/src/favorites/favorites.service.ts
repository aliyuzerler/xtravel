import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ERROR_CODES } from '@turizm-pazaryeri/shared';
import { NotFoundError, paginate } from '../common';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Toggle favori — ekler veya çıkarır. Optimistik UI için yeni durumu döner.
   */
  async toggle(userId: string, serviceId: string): Promise<{ isFavorite: boolean }> {
    // Service var mı?
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, status: true },
    });
    if (!service) throw new NotFoundError('Hizmet');

    // Mevcut favoriyi kontrol et
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_serviceId: { userId, serviceId } },
    });

    if (existing) {
      await this.prisma.favorite.delete({
        where: { userId_serviceId: { userId, serviceId } },
      });
      this.logger.log(`Favorite removed: user=${userId} service=${serviceId}`);
      return { isFavorite: false };
    } else {
      await this.prisma.favorite.create({
        data: { userId, serviceId },
      });
      this.logger.log(`Favorite added: user=${userId} service=${serviceId}`);
      return { isFavorite: true };
    }
  }

  /**
   * Kullanıcının bir hizmeti favori olup olmadığını kontrol et.
   */
  async isFavorite(userId: string, serviceId: string): Promise<boolean> {
    const fav = await this.prisma.favorite.findUnique({
      where: { userId_serviceId: { userId, serviceId } },
      select: { userId: true },
    });
    return !!fav;
  }

  /**
   * Kullanıcının favori hizmet ID'lerini döner (büyük listeler için).
   * Service slug'ı da dahil — frontend'de "kalp dolu" kontrolü için.
   */
  async listFavoriteServiceIds(userId: string): Promise<string[]> {
    const favs = await this.prisma.favorite.findMany({
      where: { userId },
      select: { serviceId: true },
    });
    return favs.map((f) => f.serviceId);
  }

  /**
   * Kullanıcının favori hizmetlerini tam detayla listeler.
   */
  async listForUser(userId: string, query: { page?: number; limit?: number }) {
    return paginate(
      this.prisma.favorite,
      {
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          service: {
            select: {
              id: true, title: true, slug: true, durationHours: true,
              status: true, avgRating: true, reviewCount: true,
              category: { select: { name: true, slug: true } },
              city: { select: { name: true, slug: true } },
              images: { where: { isMain: true }, take: 1 },
              pricing: { where: { isActive: true }, orderBy: { price: 'asc' }, take: 1 },
            },
          },
        },
      },
      { page: query.page, limit: query.limit },
    );
  }
}

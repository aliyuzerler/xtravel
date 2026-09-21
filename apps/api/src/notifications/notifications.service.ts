import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@turizm-pazaryeri/shared';

/**
 * Bildirim oluşturma servisi.
 * Tüm modüller (admin, provider, user) bu servisi kullanır.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Tek bir bildirim oluştur.
   */
  async create(params: {
    userId: string;
    type: NotificationType | string;
    title: string;
    message: string;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        isRead: false,
      },
    });
    this.logger.log(`Notification created: user=${params.userId} type=${params.type} title="${params.title}"`);
    return notification;
  }

  /**
   * Bir sağlayıcıya bildirim gönder (service_providers.user_id üzerinden).
   */
  async notifyProvider(params: {
    providerId: string;
    type: NotificationType | string;
    title: string;
    message: string;
  }) {
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { id: params.providerId },
      select: { userId: true, companyName: true },
    });
    if (!provider) {
      this.logger.warn(`notifyProvider: provider not found (${params.providerId})`);
      return null;
    }
    return this.create({
      userId: provider.userId,
      type: params.type,
      title: params.title,
      message: params.message,
    });
  }

  /**
   * Bir kullanıcıya bildirim gönder.
   */
  async notifyUser(params: {
    userId: string;
    type: NotificationType | string;
    title: string;
    message: string;
  }) {
    return this.create(params);
  }
}

import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ERROR_CODES } from '@turizm-pazaryeri/shared';
import { NotFoundError, ForbiddenError, paginate } from '../common';

/**
 * Chat servisi — rezervasyon bazlı konuşma (kullanıcı ↔ sağlayıcı).
 *
 * Kurallar (A5 rol matrisi + business):
 *   - Konuşma yalnızca confirmed/completed rezervasyonu olan kullanıcı ile
 *     hizmetin sağlayıcısı arasında başlar.
 *   - Conversation rezervasyon başına 1 adet (unique reservationId).
 *   - Mesajlar sıralı (createdAt asc), pagination ile.
 *   - Okunmamış mesaj sayısı badge için.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Bir rezervasyon için conversation başlat veya mevcut olanı döndür.
   * Yalnızca rezervasyon sahibi kullanıcı veya hizmetin sağlayıcısı çağırabilir.
   */
  async getOrCreateConversation(userId: string, reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        service: { select: { providerId: true, title: true } },
      },
    });
    if (!reservation) throw new NotFoundError('Rezervasyon');

    // Yetki: kullanıcı rezervasyon sahibi mi, yoksa hizmetin sağlayıcısı mı?
    const isReservationOwner = reservation.userId === userId;
    let isProvider = false;
    if (!isReservationOwner) {
      const provider = await this.prisma.serviceProvider.findUnique({
        where: { userId },
      });
      isProvider = provider?.id === reservation.service.providerId;
    }

    if (!isReservationOwner && !isProvider) {
      throw new ForbiddenError('Bu rezervasyon için konuşmaya erişim yetkiniz yok', ERROR_CODES.OWNERSHIP_VIOLATION);
    }

    // Sadece confirmed/completed rezervasyonlar için konuşma açılabilir
    if (!['confirmed', 'completed'].includes(reservation.status)) {
      throw new ForbiddenError('Bu rezervasyon durumu için chat açılamaz', ERROR_CODES.RESOURCE_CONFLICT);
    }

    // Mevcut conversation'ı bul veya oluştur
    const existing = await this.prisma.conversation.findUnique({
      where: { reservationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
    });

    if (existing) return existing;

    // Yeni conversation oluştur
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { id: reservation.service.providerId },
    });

    if (!provider) throw new NotFoundError('Sağlayıcı');

    return this.prisma.conversation.create({
      data: {
        reservationId,
        userId: reservation.userId,
        providerId: provider.id,
      },
      include: {
        messages: { take: 0 },
      },
    });
  }

  /**
   * Bir conversation'ın mesajlarını listele (pagination).
   */
  async listMessages(
    userId: string,
    conversationId: string,
    query: { page?: number; limit?: number },
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundError('Konuşma');

    // Yetki kontrolü
    await this.assertAccess(conversation, userId);

    return paginate(
      this.prisma.message,
      {
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      },
      { page: query.page, limit: query.limit },
    );
  }

  /**
   * Mesaj gönder (WebSocket veya HTTP).
   */
  async sendMessage(
    senderId: string,
    conversationId: string,
    content: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundError('Konuşma');

    await this.assertAccess(conversation, senderId);

    // Sender type: user mu provider mu?
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { userId: senderId },
    });
    const senderType = provider?.id === conversation.providerId ? 'provider' : 'user';

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        senderType,
        content,
      },
    });

    // Conversation lastMessageAt güncelle
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    this.logger.log(`Message sent: conv=${conversationId} sender=${senderId} (${senderType})`);
    return message;
  }

  /**
   * Kullanıcının konuşmalarını listele (user veya provider).
   */
  async listConversations(userId: string, query: { page?: number; limit?: number }) {
    // Kullanıcı user ise userId'ye göre, provider ise providerId'ye göre
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { userId },
    });

    const where: any = {};
    if (provider) {
      where.providerId = provider.id;
    } else {
      where.userId = userId;
    }

    return paginate(
      this.prisma.conversation,
      {
        where,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          reservation: {
            select: {
              id: true, reservationCode: true,
              service: { select: { id: true, title: true } },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
      { page: query.page, limit: query.limit },
    );
  }

  /**
   * Okunmamış mesaj sayısı (kullanıcı için).
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { userId },
    });

    const where: any = {
      isRead: false,
      senderId: { not: userId },
    };
    if (provider) {
      where.conversation = { providerId: provider.id };
    } else {
      where.conversation = { userId };
    }

    const count = await this.prisma.message.count({ where });
    return { count };
  }

  /**
   * Bir conversation'daki mesajları okundu işaretle (karşı tarafınkiler).
   */
  async markAsRead(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundError('Konuşma');
    await this.assertAccess(conversation, userId);

    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    return { marked: true };
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------
  private async assertAccess(conversation: any, userId: string) {
    // Kullanıcı conversation.user mı?
    if (conversation.userId === userId) return;

    // Yoksa sağlayıcı mı?
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { userId },
    });
    if (provider?.id === conversation.providerId) return;

    throw new ForbiddenError('Bu konuşmaya erişim yetkiniz yok', ERROR_CODES.OWNERSHIP_VIOLATION);
  }
}

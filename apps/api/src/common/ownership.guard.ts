import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { ERROR_CODES } from '@turizm-pazaryeri/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from './roles.guard';

/**
 * Sağlayıcı kaynaklarına (hizmet, rezervasyon vb.) ownership kontrolü yapar.
 *
 * URL desenleri:
 *   /api/provider/services/:id              → Service.provider.userId == req.user.sub
 *   /api/provider/services/:serviceId/...   → alt kaynaklar (images, pricing, schedules)
 *   /api/provider/reservations/:id          → Reservation.service.provider.userId == req.user.sub
 *
 * Admin her şeye erişebilir.
 * Kullanıcı rolü (user) provider endpoint'lerine erişemez — RolesGuard zaten engeller.
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    if (!user) return true; // public endpoint

    // Admin her şeyi görebilir
    if (user.role === 'super_admin') return true;

    // Sadece sağlayıcı kaynakları için ownership kontrolü yapılır
    const path = request.path;
    if (!path.includes('/provider/')) return true;

    // Sağlayıcı değilse provider endpoint'lerine erişemez
    if (user.role !== 'provider') {
      throw new ForbiddenException({
        success: false,
        message: 'Bu işlem için sağlayıcı rolü gerekli',
        statusCode: 403,
        code: ERROR_CODES.ROLE_FORBIDDEN,
      });
    }

    const serviceId = this.getParam(request, 'id') || this.getParam(request, 'serviceId');
    const reservationId = this.getParam(request, 'id') || this.getParam(request, 'reservationId');

    if (serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: serviceId },
        select: { provider: { select: { userId: true } } },
      });
      if (!service) {
        throw new ForbiddenException({
          success: false,
          message: 'Hizmet bulunamadı',
          statusCode: 403,
          code: ERROR_CODES.OWNERSHIP_VIOLATION,
        });
      }
      if (service.provider.userId !== user.sub) {
        throw new ForbiddenException({
          success: false,
          message: 'Bu kaynağa erişim yetkiniz yok',
          statusCode: 403,
          code: ERROR_CODES.OWNERSHIP_VIOLATION,
        });
      }
    }

    if (reservationId) {
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: reservationId },
        select: { service: { select: { provider: { select: { userId: true } } } } },
      });
      if (!reservation) {
        throw new ForbiddenException({
          success: false,
          message: 'Rezervasyon bulunamadı',
          statusCode: 403,
          code: ERROR_CODES.OWNERSHIP_VIOLATION,
        });
      }
      if (reservation.service.provider.userId !== user.sub) {
        throw new ForbiddenException({
          success: false,
          message: 'Bu rezervasyona erişim yetkiniz yok',
          statusCode: 403,
          code: ERROR_CODES.OWNERSHIP_VIOLATION,
        });
      }
    }

    return true;
  }

  private getParam(req: Request, name: string): string | undefined {
    const params = (req as any).params || {};
    return params[name];
  }
}

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResponseInterceptor, RequestUser, paginate } from '../common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Kullanıcı bildirimleri API'si.
 * - GET /api/user/notifications — listele (sayfalı)
 * - POST /api/user/notifications/:id/read — tek bildirimi okundu işaretle
 * - POST /api/user/notifications/read-all — hepsini okundu işaretle
 */
@Controller()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
export class NotificationsController {
  constructor(private prisma: PrismaService) {}

  @Get('user/notifications')
  async listForUser(
    @Req() req: Express.Request & { user: RequestUser },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unread') unread?: string,
  ) {
    const where: any = { userId: req.user.sub };
    if (unread === 'true') where.isRead = false;
    return paginate(
      this.prisma.notification,
      {
        where,
        orderBy: { createdAt: 'desc' },
      },
      { page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined },
    );
  }

  @Post('user/notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') id: string,
  ) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== req.user.sub) {
      return { success: false, message: 'Bildirim bulunamadı' };
    }
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  @Post('user/notifications/read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@Req() req: Express.Request & { user: RequestUser }) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: req.user.sub, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }
}

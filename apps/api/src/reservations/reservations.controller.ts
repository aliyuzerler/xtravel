import {
  Body,
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
import { RolesGuard, Roles, ResponseInterceptor, RequestUser } from '../common';
import { UserRole } from '@turizm-pazaryeri/shared';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto, CancelReservationDto } from './dto';

/**
 * User reservations API — yalnızca kullanıcı kendi rezervasyonlarını yönetir.
 * Rol: user (admin de erişebilir)
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.SUPER_ADMIN, UserRole.PROVIDER)
@UseInterceptors(ResponseInterceptor)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  /**
   * POST /api/reservations
   * Yeni rezervasyon oluştur (pending_payment olarak başlar).
   * Atomic capacity check ile.
   */
  @Post('reservations')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: Express.Request & { user: RequestUser },
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservationsService.create(req.user.sub, dto);
  }

  /**
   * GET /api/user/reservations
   * Kullanıcının kendi rezervasyonlarını listeler.
   */
  @Get('user/reservations')
  async listForUser(
    @Req() req: Express.Request & { user: RequestUser },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.reservationsService.listForUser(req.user.sub, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
    });
  }

  /**
   * GET /api/user/reservations/:id
   * Tek rezervasyon detayı (sahiplik kontrolü ile).
   */
  @Get('user/reservations/:id')
  async getForUser(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.reservationsService.getForUser(req.user.sub, id);
  }

  /**
   * POST /api/user/reservations/:id/cancel
   * Kullanıcı kendi rezervasyonunu iptal eder.
   * İptal politikası uygulanır (refund hesabı).
   */
  @Post('user/reservations/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelByUser(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') id: string,
    @Body() dto: CancelReservationDto,
  ) {
    return this.reservationsService.cancelByUser(req.user.sub, id, dto);
  }
}

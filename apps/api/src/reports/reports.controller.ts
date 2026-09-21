import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles, ResponseInterceptor, RequestUser } from '../common';
import { UserRole } from '@turizm-pazaryeri/shared';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
@UseInterceptors(ResponseInterceptor)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private prisma: PrismaService,
  ) {}

  // ===========================================================================
  // PROVIDER RAPORLARI
  // ===========================================================================

  @Get('provider/reports/occupancy')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.SUPER_ADMIN)
  async getProviderOccupancy(@Req() req: Express.Request & { user: RequestUser }) {
    const provider = await this.requireProvider(req.user.sub);
    return this.reportsService.getProviderOccupancy(provider.id);
  }

  @Get('provider/reports/cancellation-rate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.SUPER_ADMIN)
  async getProviderCancellationRate(@Req() req: Express.Request & { user: RequestUser }) {
    const provider = await this.requireProvider(req.user.sub);
    return this.reportsService.getProviderCancellationRate(provider.id);
  }

  @Get('provider/reports/monthly-earnings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.SUPER_ADMIN)
  async getProviderMonthlyEarnings(
    @Req() req: Express.Request & { user: RequestUser },
    @Query('months') months?: string,
  ) {
    const provider = await this.requireProvider(req.user.sub);
    return this.reportsService.getProviderMonthlyEarnings(provider.id, months ? parseInt(months, 10) : 6);
  }

  /**
   * GET /api/provider/reports/export-csv
   * CSV dosyası olarak indir.
   */
  @Get('provider/reports/export-csv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.SUPER_ADMIN)
  async exportProviderCSV(
    @Req() req: Express.Request & { user: RequestUser },
    @Res() res: Response,
  ) {
    const provider = await this.requireProvider(req.user.sub);
    const csv = await this.reportsService.exportProviderReservationsCSV(provider.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rezervasyonlar-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\ufeff' + csv); // BOM for Excel UTF-8
  }

  // ===========================================================================
  // ADMİN RAPORLARI
  // ===========================================================================

  @Get('admin/reports/category-sales')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getAdminCategorySales() {
    return this.reportsService.getAdminCategorySales();
  }

  @Get('admin/reports/city-sales')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getAdminCitySales() {
    return this.reportsService.getAdminCitySales();
  }

  @Get('admin/reports/commission-revenue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getAdminCommissionRevenue() {
    return this.reportsService.getAdminCommissionRevenue();
  }

  @Get('admin/reports/provider-ranking')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getAdminProviderRanking() {
    return this.reportsService.getAdminProviderRanking();
  }

  // ===========================================================================
  // HELPER
  // ===========================================================================
  private async requireProvider(userId: string) {
    const provider = await this.prisma.serviceProvider.findUnique({ where: { userId } });
    if (!provider) throw new Error('Sağlayıcı bulunamadı');
    return provider;
  }
}

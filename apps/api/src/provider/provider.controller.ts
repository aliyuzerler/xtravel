import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles, ResponseInterceptor, RequestUser } from '../common';
import { UserRole } from '@turizm-pazaryeri/shared';
import { ProviderService } from './provider.service';
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

/**
 * Provider API — yalnızca kendi kaynaklarını yönetebilir.
 * RolesGuard + provider.service.requireProvider (ownership + approved status)
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PROVIDER, UserRole.SUPER_ADMIN)
@UseInterceptors(ResponseInterceptor)
export class ProviderController {
  constructor(private readonly providerService: ProviderService) {}

  // ===========================================================================
  // PROFILE
  // ===========================================================================
  @Get('provider/profile')
  async getProfile(@Req() req: Express.Request & { user: RequestUser }) {
    return this.providerService.getProfile(req.user.sub);
  }

  @Put('provider/profile')
  async updateProfile(
    @Req() req: Express.Request & { user: RequestUser },
    @Body() dto: UpdateProviderProfileDto,
  ) {
    return this.providerService.updateProfile(req.user.sub, dto);
  }

  // ===========================================================================
  // DASHBOARD
  // ===========================================================================
  @Get('provider/dashboard/stats')
  async getDashboardStats(@Req() req: Express.Request & { user: RequestUser }) {
    return this.providerService.getDashboardStats(req.user.sub);
  }

  // ===========================================================================
  // SERVICES — list & detail (sadece kendi)
  // ===========================================================================
  @Get('provider/services')
  async listServices(
    @Req() req: Express.Request & { user: RequestUser },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.providerService.listServices(req.user.sub, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      search,
    });
  }

  @Get('provider/services/:id')
  async getService(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.providerService.getService(req.user.sub, id);
  }

  @Post('provider/services')
  @HttpCode(HttpStatus.CREATED)
  async createService(
    @Req() req: Express.Request & { user: RequestUser },
    @Body() dto: CreateServiceDto,
  ) {
    return this.providerService.createService(req.user.sub, dto);
  }

  @Put('provider/services/:id')
  async updateService(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.providerService.updateService(req.user.sub, id, dto);
  }

  @Post('provider/services/:id/submit')
  @HttpCode(HttpStatus.OK)
  async submitForApproval(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.providerService.submitForApproval(req.user.sub, id);
  }

  @Delete('provider/services/:id')
  async deleteService(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') id: string,
  ) {
    await this.providerService.deleteService(req.user.sub, id);
    return { deleted: true, id };
  }

  // ===========================================================================
  // IMAGES (sadece kendi hizmetine)
  // ===========================================================================
  @Post('provider/services/:id/images')
  @HttpCode(HttpStatus.CREATED)
  async addImage(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') id: string,
    @Body() dto: AddServiceImageDto,
  ) {
    return this.providerService.addImage(req.user.sub, id, dto);
  }

  @Put('provider/services/:serviceId/images/:imageId')
  async updateImage(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('serviceId') serviceId: string,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateServiceImageDto,
  ) {
    return this.providerService.updateImage(req.user.sub, serviceId, imageId, dto);
  }

  @Delete('provider/images/:imageId')
  @HttpCode(HttpStatus.OK)
  async deleteImage(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('imageId') imageId: string,
    @Body() body: { serviceId: string },
  ) {
    return this.providerService.deleteImage(req.user.sub, body.serviceId, imageId);
  }

  // ===========================================================================
  // PRICING
  // ===========================================================================
  @Get('provider/services/:id/pricing')
  async listPricing(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.providerService.listPricing(req.user.sub, id);
  }

  @Post('provider/services/:id/pricing')
  @HttpCode(HttpStatus.CREATED)
  async addPricing(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') id: string,
    @Body() dto: CreatePricingDto,
  ) {
    return this.providerService.addPricing(req.user.sub, id, dto);
  }

  @Put('provider/services/:serviceId/pricing/:pricingId')
  async updatePricing(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('serviceId') serviceId: string,
    @Param('pricingId') pricingId: string,
    @Body() dto: UpdatePricingDto,
  ) {
    return this.providerService.updatePricing(req.user.sub, serviceId, pricingId, dto);
  }

  @Delete('provider/services/:serviceId/pricing/:pricingId')
  @HttpCode(HttpStatus.OK)
  async deletePricing(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('serviceId') serviceId: string,
    @Param('pricingId') pricingId: string,
  ) {
    await this.providerService.deletePricing(req.user.sub, serviceId, pricingId);
    return { deleted: true, id: pricingId };
  }

  // ===========================================================================
  // SCHEDULES
  // ===========================================================================
  @Get('provider/services/:id/schedules')
  async listSchedules(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.providerService.listSchedules(req.user.sub, id);
  }

  @Post('provider/services/:id/schedules')
  @HttpCode(HttpStatus.CREATED)
  async addSchedule(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') id: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.providerService.addSchedule(req.user.sub, id, dto);
  }

  @Post('provider/services/:id/schedules/bulk')
  @HttpCode(HttpStatus.CREATED)
  async bulkAddSchedules(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') id: string,
    @Body() dto: BulkCreateSchedulesDto,
  ) {
    return this.providerService.bulkAddSchedules(req.user.sub, id, dto);
  }

  @Put('provider/services/:serviceId/schedules/:scheduleId')
  async updateSchedule(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('serviceId') serviceId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.providerService.updateSchedule(req.user.sub, serviceId, scheduleId, dto);
  }

  @Delete('provider/services/:serviceId/schedules/:scheduleId')
  @HttpCode(HttpStatus.OK)
  async deleteSchedule(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('serviceId') serviceId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    await this.providerService.deleteSchedule(req.user.sub, serviceId, scheduleId);
    return { deleted: true, id: scheduleId };
  }

  // ===========================================================================
  // RESERVATIONS (incoming)
  // ===========================================================================
  @Get('provider/reservations')
  async listReservations(
    @Req() req: Express.Request & { user: RequestUser },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.providerService.listReservations(req.user.sub, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      search,
    });
  }

  @Put('provider/reservations/:id/confirm')
  async confirmReservation(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.providerService.confirmReservation(req.user.sub, id);
  }

  @Put('provider/reservations/:id/cancel')
  async cancelReservation(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') id: string,
    @Body() dto: CancelReservationDto,
  ) {
    return this.providerService.cancelReservation(req.user.sub, id, dto);
  }

  // ===========================================================================
  // EARNINGS
  // ===========================================================================
  @Get('provider/earnings')
  async getEarnings(
    @Req() req: Express.Request & { user: RequestUser },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.providerService.getEarnings(req.user.sub, { from, to });
  }
}

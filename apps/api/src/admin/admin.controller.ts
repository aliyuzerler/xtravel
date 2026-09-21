import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles, ResponseInterceptor } from '../common';
import { UserRole } from '@turizm-pazaryeri/shared';
import { AdminService } from './admin.service';
import {
  ApproveProviderDto,
  RejectProviderDto,
  ApproveServiceDto,
  RejectServiceDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateCityDto,
  UpdateCityDto,
  UpdateUserStatusDto,
} from './dto';

/**
 * Süper Admin paneli API'si.
 * Tüm endpoint'ler JwtAuthGuard + @Roles(SUPER_ADMIN) ile korunur.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@UseInterceptors(ResponseInterceptor)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ===========================================================================
  // DASHBOARD
  // ===========================================================================
  @Get('dashboard/stats')
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // ===========================================================================
  // USERS
  // ===========================================================================
  @Get('users')
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listUsers({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      role,
      status,
      search,
    });
  }

  @Put('users/:id/status')
  async updateUserStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.adminService.updateUserStatus(id, dto);
  }

  // ===========================================================================
  // PROVIDERS (onay/red)
  // ===========================================================================
  @Get('providers')
  async listProviders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listProviders({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      search,
    });
  }

  @Get('providers/:id')
  async getProvider(@Param('id') id: string) {
    return this.adminService.getProvider(id);
  }

  @Put('providers/:id/approve')
  async approveProvider(@Param('id') id: string, @Body() dto: ApproveProviderDto) {
    return this.adminService.approveProvider(id, dto);
  }

  @Put('providers/:id/reject')
  async rejectProvider(@Param('id') id: string, @Body() dto: RejectProviderDto) {
    return this.adminService.rejectProvider(id, dto);
  }

  // ===========================================================================
  // SERVICES (onay/red)
  // ===========================================================================
  @Get('services')
  async listServices(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listServices({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      search,
    });
  }

  @Get('services/:id')
  async getService(@Param('id') id: string) {
    return this.adminService.getService(id);
  }

  @Put('services/:id/approve')
  async approveService(@Param('id') id: string, @Body() dto: ApproveServiceDto) {
    return this.adminService.approveService(id, dto);
  }

  @Put('services/:id/reject')
  async rejectService(@Param('id') id: string, @Body() dto: RejectServiceDto) {
    return this.adminService.rejectService(id, dto);
  }

  // ===========================================================================
  // CATEGORIES
  // ===========================================================================
  @Get('categories')
  async listCategories() {
    return this.adminService.listCategories();
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.adminService.createCategory(dto);
  }

  @Put('categories/:id')
  async updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.adminService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.OK)
  async deleteCategory(@Param('id') id: string) {
    await this.adminService.deleteCategory(id);
    return { deleted: true, id };
  }

  // ===========================================================================
  // CITIES
  // ===========================================================================
  @Get('cities')
  async listCities() {
    return this.adminService.listCities();
  }

  @Post('cities')
  @HttpCode(HttpStatus.CREATED)
  async createCity(@Body() dto: CreateCityDto) {
    return this.adminService.createCity(dto);
  }

  @Put('cities/:id')
  async updateCity(@Param('id') id: string, @Body() dto: UpdateCityDto) {
    return this.adminService.updateCity(id, dto);
  }

  @Delete('cities/:id')
  @HttpCode(HttpStatus.OK)
  async deleteCity(@Param('id') id: string) {
    await this.adminService.deleteCity(id);
    return { deleted: true, id };
  }

  // ===========================================================================
  // SETTINGS
  // ===========================================================================
  @Get('settings')
  async getSettings() {
    return this.adminService.getSettings();
  }

  @Put('settings/:key')
  async updateSetting(@Param('key') key: string, @Body() body: { value: any }) {
    return this.adminService.updateSetting(key, body.value);
  }

  // ===========================================================================
  // RESERVATIONS (read-only)
  // ===========================================================================
  @Get('reservations')
  async listReservations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listReservations({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      search,
    });
  }

  // ===========================================================================
  // PAYMENTS (read-only)
  // ===========================================================================
  @Get('payments')
  async listPayments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listPayments({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      search,
    });
  }
}

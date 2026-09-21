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
import { RolesGuard, Roles, ResponseInterceptor, RequestUser, paginate } from '../common';
import { UserRole } from '@turizm-pazaryeri/shared';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, RejectReviewDto, ReviewListQueryDto } from './dto';

/**
 * Reviews API — yorum ve puan sistemi.
 *
 * - POST /api/services/:id/reviews — kullanıcı yorumu (completed rezervasyon zorunlu)
 * - GET /api/services/:id/reviews — public, approved yorumlar + puan dağılımı
 * - GET /api/user/reviews — kullanıcının kendi yorumları
 * - DELETE /api/user/reviews/:id — kendi yorumunu sil (yalnızca pending/rejected)
 *
 * Admin:
 * - GET /api/admin/reviews — tüm yorumlar (status filter)
 * - PUT /api/admin/reviews/:id/approve — onayla (avgRating yeniden hesaplanır)
 * - PUT /api/admin/reviews/:id/reject — reddet (gerekçe zorunlu)
 */
@Controller()
@UseInterceptors(ResponseInterceptor)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ===========================================================================
  // PUBLIC
  // ===========================================================================

  /**
   * GET /api/services/:id/reviews
   * Onaylı yorumları listeler + puan dağılımı + avg/count özet.
   */
  @Get('services/:id/reviews')
  async listPublicReviews(
    @Param('id') serviceId: string,
    @Query() query: ReviewListQueryDto,
  ) {
    return this.reviewsService.listPublicReviews(serviceId, query);
  }

  // ===========================================================================
  // USER
  // ===========================================================================

  /**
   * POST /api/services/:id/reviews
   * Kullanıcı yorumu oluştur (pending). Completed rezervasyon zorunlu.
   */
  @Post('services/:id/reviews')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.SUPER_ADMIN)
  async createReview(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') serviceId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(req.user.sub, serviceId, dto);
  }

  /**
   * GET /api/user/reviews
   * Kullanıcının kendi yorumları (her durumda).
   */
  @Get('user/reviews')
  @UseGuards(JwtAuthGuard)
  async listMyReviews(
    @Req() req: Express.Request & { user: RequestUser },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.listMyReviews(req.user.sub, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * DELETE /api/user/reviews/:id
   * Kullanıcı kendi yorumunu siler (yalnızca pending/rejected).
   */
  @Delete('user/reviews/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async deleteMyReview(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') id: string,
  ) {
    return this.reviewsService.deleteMyReview(req.user.sub, id);
  }

  // ===========================================================================
  // ADMIN
  // ===========================================================================

  @Get('admin/reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async listForAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('serviceId') serviceId?: string,
  ) {
    return this.reviewsService.listForAdmin({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      serviceId,
    });
  }

  @Put('admin/reviews/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async approveReview(@Param('id') id: string) {
    return this.reviewsService.approveReview(id);
  }

  @Put('admin/reviews/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async rejectReview(
    @Param('id') id: string,
    @Body() dto: RejectReviewDto,
  ) {
    return this.reviewsService.rejectReview(id, dto);
  }
}

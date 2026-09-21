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
import { ResponseInterceptor, RequestUser } from '../common';
import { FavoritesService } from './favorites.service';

/**
 * Favorites API — favori hizmetler.
 *
 * - POST /api/services/:id/favorite — toggle (ekle/çıkar)
 * - GET /api/user/favorites — kullanıcının favori hizmetleri
 * - GET /api/user/favorites/ids — sadece service ID listesi (kalp dolu kontrolü için)
 */
@Controller()
@UseInterceptors(ResponseInterceptor)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  /**
   * POST /api/services/:id/favorite
   * Favori toggle — optimistik UI için { isFavorite: boolean } döner.
   */
  @Post('services/:id/favorite')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async toggle(
    @Req() req: Express.Request & { user: RequestUser },
    @Param('id') serviceId: string,
  ) {
    return this.favoritesService.toggle(req.user.sub, serviceId);
  }

  /**
   * GET /api/user/favorites
   * Kullanıcının favori hizmetlerini tam detayla listeler.
   */
  @Get('user/favorites')
  @UseGuards(JwtAuthGuard)
  async listForUser(
    @Req() req: Express.Request & { user: RequestUser },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.favoritesService.listForUser(req.user.sub, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /api/user/favorites/ids
   * Sadece service ID listesi döner — frontend'de kalp ikonlarını doldurmak için.
   */
  @Get('user/favorites/ids')
  @UseGuards(JwtAuthGuard)
  async listIds(@Req() req: Express.Request & { user: RequestUser }) {
    const ids = await this.favoritesService.listFavoriteServiceIds(req.user.sub);
    return { ids };
  }
}

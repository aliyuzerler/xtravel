import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ResponseInterceptor } from '../common';
import { PublicService } from './public.service';
import { PublicListQueryDto } from './dto';

/**
 * Public API — misafir erişimi (kimlik doğrulama gerekmez).
 * Sadece published hizmetleri ve aktif kategori/şehirleri döner.
 */
@Controller()
@UseInterceptors(ResponseInterceptor)
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('cities')
  async listCities() {
    return this.publicService.listCities();
  }

  @Get('categories')
  async listCategories() {
    return this.publicService.listCategories();
  }

  @Get('services')
  async listServices(@Query() query: PublicListQueryDto) {
    return this.publicService.listServices(query);
  }

  @Get('featured-services')
  async listFeatured(@Query('limit') limit?: string) {
    return this.publicService.listFeaturedServices(limit ? parseInt(limit, 10) : 8);
  }

  @Get('services/:slug')
  async getServiceBySlug(@Param('slug') slug: string) {
    return this.publicService.getServiceBySlug(slug);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestUser } from '../common';
import { ResponseInterceptor } from '../common/response.interceptor';
import { UploadsService } from './uploads.service';
import { PresignUploadDto } from './dto';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '@turizm-pazaryeri/shared';

@Controller('uploads')
@UseInterceptors(ResponseInterceptor)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * POST /api/uploads/presign
   * S3 presigned URL üretir (sadece kimlik doğrulamış kullanıcılar).
   * Body: { filename, contentType, size?, folder? }
   * Response: { key, uploadUrl, publicUrl, method, expiresInSeconds, headers }
   */
  @Post('presign')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.PROVIDER, UserRole.USER)
  async presign(
    @Req() req: Request & { user: RequestUser },
    @Body() dto: PresignUploadDto,
  ) {
    const result = await this.uploadsService.presign({
      filename: dto.filename,
      contentType: dto.contentType,
      size: dto.size,
      folder: dto.folder,
    });
    return result;
  }

  /**
   * PUT /api/uploads/receive — sandbox içindir.
   *
   * Sandbox modunda S3 yerine bu endpoint'i kullanırız.
   * Üretimde bu endpoint devre dışı bırakılır; client doğrudan S3'e PUT yapar.
   *
   * Body: raw binary dosya
   * Query: key, contentType
   */
  @Post('receive')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Query('key') key: string,
    @Query('contentType') contentType: string,
    @Req() req: Request,
  ) {
    // Express raw body için req'i buffer olarak oku
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const body = Buffer.concat(chunks);

    const result = await this.uploadsService.receive(key, contentType, body);
    return result;
  }
}

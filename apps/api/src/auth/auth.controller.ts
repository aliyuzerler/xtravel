import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RequestUser } from '../common';
import { AuthService } from './auth.service';
import { env } from '../env';
import {
  RegisterDto,
  LoginDto,
  RefreshDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ProviderApplyDto,
} from './dto';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '@turizm-pazaryeri/shared';
import { ResponseInterceptor } from '../common/response.interceptor';

@Controller('auth')
@UseInterceptors(ResponseInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/register
   * Yeni kullanıcı (user veya provider) kaydı.
   * Rate limit: 3/dk (env'den)
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: env.RATE_LIMIT_REGISTER_PER_MINUTE, ttl: 60_000 } as any })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      expiresIn: result.tokens.expiresIn,
    };
  }

  /**
   * POST /api/auth/login
   * Rate limit: 5/dk
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: env.RATE_LIMIT_LOGIN_PER_MINUTE, ttl: 60_000 } as any })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      expiresIn: result.tokens.expiresIn,
    };
  }

  /**
   * POST /api/auth/logout
   * Tüm refresh token'ları iptal eder (access token hâlâ geçerli olabilir; client silmeli).
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Express.Request & { user: RequestUser }) {
    return this.authService.logout(req.user.sub);
  }

  /**
   * POST /api/auth/refresh
   * Refresh token ile yeni access token + yeni refresh token üretir (rotasyon).
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    const result = await this.authService.refresh(dto.refreshToken);
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      expiresIn: result.tokens.expiresIn,
    };
  }

  /**
   * POST /api/auth/forgot-password
   * Şifre sıfırlama linki gönderir (eğer e-posta kayıtlıysa).
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } as any })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  /**
   * POST /api/auth/reset-password
   * Tek kullanımlık token ile şifreyi sıfırlar.
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  /**
   * POST /api/provider/apply
   * Mevcut kullanıcı sağlayıcı başvurusu yapar (user → provider pending).
   */
  @Post('apply-provider')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async applyProvider(
    @Req() req: Express.Request & { user: RequestUser },
    @Body() dto: ProviderApplyDto,
  ) {
    return this.authService.applyProvider(req.user.sub, dto);
  }

  /**
   * GET /api/auth/me
   * Giriş yapmış kullanıcının güncel bilgileri.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Express.Request & { user: RequestUser }) {
    return this.authService.me(req.user.sub);
  }
}

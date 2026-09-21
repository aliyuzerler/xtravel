import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../env';
import {
  UserRole,
  UserStatus,
  ProviderStatus,
  ERROR_CODES,
} from '@turizm-pazaryeri/shared';
import {
  AuthError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  BusinessError,
} from '../common/errors';
import {
  JwtAccessPayload,
} from './jwt.strategy';
import { RefreshTokenStore, TokenError } from './refresh-token.store';
import { PasswordResetStore } from './password-reset.store';
import { EmailService } from '../common/email.service';
import {
  RegisterDto,
  LoginDto,
  ProviderApplyDto,
} from './dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  providerId: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private refreshStore: RefreshTokenStore,
    private resetStore: PasswordResetStore,
    private email: EmailService,
  ) {}

  // --------------------------------------------------------------------------
  // REGISTER
  // --------------------------------------------------------------------------
  async register(dto: RegisterDto): Promise<{ user: AuthUserResponse; tokens: AuthTokens }> {
    // Aynı e-posta var mı?
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictError('Bu e-posta zaten kayıtlı', ERROR_CODES.AUTH_EMAIL_EXISTS);
    }

    if (dto.role === UserRole.PROVIDER && !dto.companyName) {
      throw new BusinessError(
        'Sağlayıcı kaydı için şirket adı zorunludur',
        ERROR_CODES.VALIDATION_FAILED,
        422,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // User + (provider ise Service_provider record) tek transaction
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        role: dto.role,
        status: dto.role === UserRole.PROVIDER ? UserStatus.PENDING : UserStatus.ACTIVE,
        ...(dto.role === UserRole.PROVIDER
          ? {
              provider: {
                create: {
                  companyName: dto.companyName!,
                  taxNumber: dto.taxNumber,
                  phone: dto.phone,
                  status: ProviderStatus.PENDING,
                },
              },
            }
          : {}),
      },
      include: { provider: true },
    });

    const tokens = await this.issueTokens(user.id, user.role as UserRole, user.status, user.provider?.id ?? null);

    this.logger.log(`User registered: ${user.email} (role=${user.role})`);

    // Email stub
    await this.email.sendWelcome(user.email, user.fullName ?? 'Kullanıcı');

    return { user: this.toAuthUser(user), tokens };
  }

  // --------------------------------------------------------------------------
  // PROVIDER APPLY (mevcut user'ı sağlayıcıya yükselt)
  // --------------------------------------------------------------------------
  async applyProvider(userId: string, dto: ProviderApplyDto): Promise<AuthUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });
    if (!user) throw new NotFoundError('Kullanıcı');

    if (user.role === UserRole.PROVIDER) {
      throw new BusinessError('Kullanıcı zaten sağlayıcı', ERROR_CODES.RESOURCE_CONFLICT, 409);
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenError('Admin rolü değiştirilemez');
    }

    // User'ı provider'a yükselt; Service_provider kaydı oluştur (pending)
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: UserRole.PROVIDER,
        status: UserStatus.PENDING,
        provider: {
          create: {
            companyName: dto.companyName,
            taxNumber: dto.taxNumber,
            phone: dto.phone ?? user.phone,
            description: dto.description,
            status: ProviderStatus.PENDING,
          },
        },
      },
      include: { provider: true },
    });

    this.logger.log(`User ${user.email} applied as provider (company=${dto.companyName})`);
    return this.toAuthUser(updated);
  }

  // --------------------------------------------------------------------------
  // LOGIN
  // --------------------------------------------------------------------------
  async login(dto: LoginDto): Promise<{ user: AuthUserResponse; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { provider: true },
    });
    if (!user) {
      // Timing-safe: hash doğrulaması yaparak gecikme ekleyin (user enumeration engellemek)
      await bcrypt.hash(dto.password, 10).catch(() => {});
      throw new AuthError('E-posta veya şifre hatalı');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new AuthError('E-posta veya şifre hatalı');
    }

    if (user.status === UserStatus.BANNED) {
      throw new AuthError('Hesabınız askıya alınmış', ERROR_CODES.AUTH_USER_BANNED);
    }

    const tokens = await this.issueTokens(
      user.id,
      user.role as UserRole,
      user.status as string,
      user.provider?.id ?? null,
    );

    this.logger.log(`Login success: ${user.email}`);
    return { user: this.toAuthUser(user), tokens };
  }

  // --------------------------------------------------------------------------
  // REFRESH (rotasyonlu)
  // --------------------------------------------------------------------------
  async refresh(refreshToken: string): Promise<{ user: AuthUserResponse; tokens: AuthTokens }> {
    let userId: string;
    let family: string;
    try {
      ({ userId, family } = this.refreshStore.verify(refreshToken));
    } catch (err) {
      if (err instanceof TokenError) {
        throw new AuthError(err.message, err.code);
      }
      throw err;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });
    if (!user) {
      throw new AuthError('Kullanıcı bulunamadı', ERROR_CODES.AUTH_TOKEN_INVALID);
    }

    if (user.status === UserStatus.BANNED) {
      this.refreshStore.revokeAllForUser(user.id);
      throw new AuthError('Hesabınız askıya alınmış', ERROR_CODES.AUTH_USER_BANNED);
    }

    // Yeni tokenlar (aynı aileye yeni refresh token)
    const tokens = await this.issueTokens(
      user.id,
      user.role as UserRole,
      user.status as string,
      user.provider?.id ?? null,
      family, // aynı aileye bağlı yeni token
    );

    return { user: this.toAuthUser(user), tokens };
  }

  // --------------------------------------------------------------------------
  // LOGOUT
  // --------------------------------------------------------------------------
  async logout(userId: string): Promise<{ revoked: number }> {
    const count = this.refreshStore.revokeAllForUser(userId);
    this.logger.log(`Logout: user=${userId} (revoked ${count} refresh tokens)`);
    return { revoked: count };
  }

  // --------------------------------------------------------------------------
  // FORGOT PASSWORD
  // --------------------------------------------------------------------------
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Güvenlik: kullanıcı yoksa bile aynı yanıtı döneriz (enumeration engellemek)
    if (user) {
      const token = this.resetStore.issue(user.id, env.PASSWORD_RESET_TOKEN_TTL_SECONDS);
      await this.email.sendPasswordReset(user.email, token);
    }
    return { message: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi (varsa).' };
  }

  // --------------------------------------------------------------------------
  // RESET PASSWORD
  // --------------------------------------------------------------------------
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    let userId: string;
    try {
      userId = this.resetStore.verify(token);
    } catch (err) {
      throw new BusinessError(
        (err as Error).message,
        ERROR_CODES.VALIDATION_FAILED,
        400,
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Tüm refresh token'ları iptal et (zorla logout)
    this.refreshStore.revokeAllForUser(userId);

    this.logger.log(`Password reset success: user=${userId}`);
    return { message: 'Şifreniz güncellendi. Lütfen tekrar giriş yapın.' };
  }

  // --------------------------------------------------------------------------
  // ME
  // --------------------------------------------------------------------------
  async me(userId: string): Promise<AuthUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });
    if (!user) throw new NotFoundError('Kullanıcı');
    return this.toAuthUser(user);
  }

  // --------------------------------------------------------------------------
  // CHANGE PASSWORD (kullanıcı giriş yapmış haldeyken)
  // --------------------------------------------------------------------------
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('Kullanıcı');

    // Mevcut şifre doğrula
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new AuthError('Mevcut şifre hatalı', ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Diğer cihazlardaki tüm refresh token'ları iptal et (güvenlik)
    this.refreshStore.revokeAllForUser(userId);

    this.logger.log(`Password changed: user=${userId}`);
    return { message: 'Şifreniz güncellendi. Diğer cihazlardan çıkış yapıldı.' };
  }

  // --------------------------------------------------------------------------
  // UPDATE PROFILE (kullanıcı kendi ad/telefonunu günceller)
  // --------------------------------------------------------------------------
  async updateProfile(
    userId: string,
    fullName?: string,
    phone?: string,
  ): Promise<AuthUserResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('Kullanıcı');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(fullName !== undefined ? { fullName } : {}),
        ...(phone !== undefined ? { phone } : {}),
      },
      include: { provider: true },
    });
    return this.toAuthUser(updated);
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------
  private async issueTokens(
    userId: string,
    role: UserRole,
    status: string,
    providerId: string | null,
    existingFamily?: string,
  ): Promise<AuthTokens> {
    const payload: JwtAccessPayload = {
      sub: userId,
      role,
      status: status as any,
      providerId,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    });

    // Refresh token: existingFamily varsa onu kullan (rotasyon), yoksa yeni aile
    const refresh = existingFamily
      ? this.refreshStore.issueWithFamily(userId, env.JWT_REFRESH_TTL_SECONDS, existingFamily)
      : this.refreshStore.issue(userId, env.JWT_REFRESH_TTL_SECONDS);

    return {
      accessToken,
      refreshToken: refresh.token,
      expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    };
  }

  private toAuthUser(user: any): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role as UserRole,
      status: user.status as unknown as UserStatus,
      providerId: user.provider?.id ?? null,
    };
  }
}

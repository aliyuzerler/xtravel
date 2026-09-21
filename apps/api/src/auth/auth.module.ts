import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RefreshTokenStore } from './refresh-token.store';
import { PasswordResetStore } from './password-reset.store';
import { EmailService } from '../common/email.service';
import { env } from '../env';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: env.JWT_ACCESS_TTL_SECONDS },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100, // global default; per-endpoint limits via @Throttle
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    RefreshTokenStore,
    PasswordResetStore,
    EmailService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [AuthService, RefreshTokenStore, PasswordResetStore, JwtModule, PassportModule],
})
export class AuthModule {}

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../env';
import { RequestUser } from '../common';
import { UserRole } from '@turizm-pazaryeri/shared';

/**
 * Access token'ı Bearer header'dan çeker ve doğrular.
 * req.user = { sub, role, status, providerId }
 */
export interface JwtAccessPayload {
  sub: string;
  role: UserRole;
  status: string;
  providerId?: string | null;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_ACCESS_SECRET,
    });
  }

  async validate(payload: JwtAccessPayload): Promise<RequestUser> {
    return {
      sub: payload.sub,
      role: payload.role,
      status: payload.status as any,
      providerId: payload.providerId ?? null,
    };
  }
}

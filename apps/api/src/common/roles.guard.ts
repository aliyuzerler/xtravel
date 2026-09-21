import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, ERROR_CODES } from '@turizm-pazaryeri/shared';
import { ROLES_KEY } from './roles.decorator';

export interface RequestUser {
  sub: string;
  role: UserRole;
  status: string;
  providerId?: string | null;
}

/**
 * Rol tabanlı erişim kontrolü.
 * @Roles() ile işaretlenen rollerden biri mevcut kullanıcının rolü ile eşleşmezse 403 döner.
 * Eğer @Roles() yoksa guard bir şey yapmaz (public endpoint).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // rol kısıtı yok → public
    }

    const request = context.switchToHttp().getRequest();
    const user: RequestUser | undefined = request.user;

    if (!user) {
      throw new ForbiddenException({
        success: false,
        message: 'Kimlik doğrulaması gerekli',
        statusCode: 403,
        code: ERROR_CODES.ROLE_FORBIDDEN,
      });
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException({
        success: false,
        message: 'Bu işlem için yetkiniz yok',
        statusCode: 403,
        code: ERROR_CODES.ROLE_FORBIDDEN,
      });
    }

    return true;
  }
}

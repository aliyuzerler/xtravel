import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@turizm-pazaryeri/shared';

export const ROLES_KEY = 'roles';

/**
 * Endpoint'e erişebilecek rolleri işaretler.
 * @Roles(UserRole.SUPER_ADMIN) → sadece admin
 * @Roles(UserRole.PROVIDER, UserRole.SUPER_ADMIN) → sağlayıcı veya admin
 * RolesGuard ile birlikte kullanılır.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

import { SetMetadata } from '@nestjs/common';
import { Permission } from '@saleassist/shared';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Requires specific permissions to access a route.
 * Usage: @RequirePermissions('contact:create', 'contact:edit')
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const ROLES_KEY = 'roles';

/**
 * Requires specific roles to access a route.
 * Usage: @RequireRoles('ADMIN', 'MANAGER')
 */
export const RequireRoles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Marks a route as public (no auth required).
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, ROLES_KEY, IS_PUBLIC_KEY } from '../decorators';
import { ROLE_PERMISSIONS, Permission } from '@saleassist/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { REDIS_KEYS } from '@saleassist/shared';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No permissions or roles required — allow
    if (!requiredPermissions?.length && !requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId = request.tenantId;

    if (!user || !tenantId) {
      throw new ForbiddenException('Authentication and tenant context required');
    }

    // Super admin bypasses all RBAC
    if (user.isSuperAdmin) return true;

    // Get user's role in this tenant
    const tenantUser = await this.getTenantUser(user.sub, tenantId);
    if (!tenantUser || !tenantUser.isActive) {
      throw new ForbiddenException('Not a member of this organization');
    }

    // Check role requirement
    if (requiredRoles?.length) {
      if (!requiredRoles.includes(tenantUser.role)) {
        throw new ForbiddenException('Insufficient role for this action');
      }
    }

    // Check permission requirement
    if (requiredPermissions?.length) {
      const userPermissions = this.getUserPermissions(tenantUser);
      const hasAll = requiredPermissions.every((p) => userPermissions.includes(p));
      if (!hasAll) {
        throw new ForbiddenException('Insufficient permissions for this action');
      }
    }

    // Attach tenant user to request for downstream use
    request.tenantUser = tenantUser;
    return true;
  }

  private async getTenantUser(userId: string, tenantId: string) {
    // Try cache first
    const cacheKey = REDIS_KEYS.userPermissions(userId, tenantId);
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const tenantUser = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      include: { customRole: true },
    });

    if (tenantUser) {
      await this.redis.set(cacheKey, tenantUser, 120); // 2 min cache
    }
    return tenantUser;
  }

  private getUserPermissions(tenantUser: any): Permission[] {
    // Custom role permissions take precedence
    if (tenantUser.customRole?.permissions?.length) {
      return tenantUser.customRole.permissions as Permission[];
    }
    // Fall back to default role permissions
    return ROLE_PERMISSIONS[tenantUser.role] || [];
  }
}

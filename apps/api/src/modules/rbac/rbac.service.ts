import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { PERMISSIONS, ROLE_PERMISSIONS, Permission, REDIS_KEYS } from '@saleassist/shared';

@Injectable()
export class RbacService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Get all available permissions.
   */
  getAllPermissions(): { key: string; value: string }[] {
    return Object.entries(PERMISSIONS).map(([key, value]) => ({ key, value }));
  }

  /**
   * Get default permissions for a built-in role.
   */
  getDefaultRolePermissions(role: string): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Create a custom role for a tenant.
   */
  async createCustomRole(tenantId: string, data: { name: string; description?: string; permissions: string[] }) {
    const existing = await this.prisma.customRole.findUnique({
      where: { tenantId_name: { tenantId, name: data.name } },
    });
    if (existing) throw new ConflictException('Role name already exists');

    return this.prisma.customRole.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        permissions: data.permissions,
      },
    });
  }

  /**
   * List custom roles for a tenant.
   */
  async listCustomRoles(tenantId: string) {
    return this.prisma.customRole.findMany({
      where: { tenantId },
      include: {
        _count: { select: { tenantUsers: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Update a custom role.
   */
  async updateCustomRole(roleId: string, data: { name?: string; description?: string; permissions?: string[] }) {
    const role = await this.prisma.customRole.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    const updated = await this.prisma.customRole.update({
      where: { id: roleId },
      data,
    });

    // Invalidate permission caches for all users with this role
    const affectedUsers = await this.prisma.tenantUser.findMany({
      where: { customRoleId: roleId },
      select: { userId: true, tenantId: true },
    });
    for (const u of affectedUsers) {
      await this.redis.del(REDIS_KEYS.userPermissions(u.userId, u.tenantId));
    }

    return updated;
  }

  /**
   * Delete a custom role.
   */
  async deleteCustomRole(roleId: string) {
    // Check if any users still have this role
    const userCount = await this.prisma.tenantUser.count({
      where: { customRoleId: roleId },
    });
    if (userCount > 0) {
      throw new ConflictException(
        `Cannot delete role: ${userCount} user(s) still assigned to this role`,
      );
    }

    return this.prisma.customRole.delete({ where: { id: roleId } });
  }
}

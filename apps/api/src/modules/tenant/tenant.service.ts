import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { REDIS_KEYS } from '@saleassist/shared';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async findById(tenantId: string) {
    // Check cache
    const cached = await this.redis.get<any>(REDIS_KEYS.tenant(tenantId));
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) throw new NotFoundException('Organization not found');

    // Cache for 5 minutes
    await this.redis.set(REDIS_KEYS.tenant(tenantId), tenant, 300);
    return tenant;
  }

  async findBySlug(slug: string): Promise<any> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });
    if (!tenant) throw new NotFoundException('Organization not found');
    return tenant;
  }

  async update(tenantId: string, data: { name?: string; logo?: string; settings?: any }): Promise<any> {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
    });

    // Invalidate cache
    await this.redis.del(REDIS_KEYS.tenant(tenantId));
    return tenant;
  }

  async getUsage(tenantId: string) {
    const [
      agentCount,
      videoMinutes,
      storageRecords,
      tenant,
    ] = await Promise.all([
      this.prisma.tenantUser.count({
        where: { tenantId, isActive: true },
      }),
      this.prisma.usageRecord.aggregate({
        where: {
          tenantId,
          metric: 'video_minutes',
          periodStart: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { quantity: true },
      }),
      this.prisma.usageRecord.aggregate({
        where: {
          tenantId,
          metric: 'storage_bytes',
        },
        _sum: { quantity: true },
      }),
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
    ]);

    return {
      agentsUsed: agentCount,
      agentsLimit: tenant?.maxAgents || 2,
      videoMinutesUsed: Number(videoMinutes._sum.quantity || 0),
      videoMinutesLimit: tenant?.maxMonthlyMinutes || 100,
      storageUsedGb: Number(storageRecords._sum.quantity || 0) / (1024 * 1024 * 1024),
      storageLimitGb: tenant?.maxStorageGb || 5,
    };
  }

  async delete(tenantId: string, userId: string) {
    // Verify user is the owner
    const tenantUser = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });

    if (!tenantUser || tenantUser.role !== 'TENANT_OWNER') {
      throw new ForbiddenException('Only the organization owner can delete it');
    }

    await this.prisma.tenant.delete({ where: { id: tenantId } });
    await this.redis.del(REDIS_KEYS.tenant(tenantId));

    return { message: 'Organization deleted' };
  }
}

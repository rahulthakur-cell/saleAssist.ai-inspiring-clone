import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@saleassist/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'error' },
              { emit: 'stdout', level: 'warn' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('🔌 Database disconnected');
  }

  /**
   * Sets the tenant context for Row-Level Security.
   * Must be called at the start of each tenant-scoped request.
   */
  async setTenantContext(tenantId: string): Promise<void> {
    await this.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant_id', '${tenantId}', true)`,
    );
  }

  /**
   * Clears the tenant context (for super admin operations).
   */
  async clearTenantContext(): Promise<void> {
    await this.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant_id', '', true)`,
    );
  }
}

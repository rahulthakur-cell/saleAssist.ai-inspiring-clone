import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators';
import { PrismaService } from './common/prisma/prisma.service';
import { RedisService } from './common/redis/redis.service';

@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @Public()
  getSystemStatus() {
    return {
      status: 'success',
      message: 'SaleAssist.ai API server is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  @Get('debug-status')
  @Public()
  async getDebugStatus() {
    let dbConnected = false;
    let dbError = null;
    let userCount = 0;
    let tableCheck: Record<string, string> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbConnected = true;

      try {
        userCount = await this.prisma.user.count();
        tableCheck.User = `Exists (${userCount} users)`;
      } catch (err: any) {
        tableCheck.User = `Error: ${err.message}`;
      }

      try {
        const tenantCount = await this.prisma.tenant.count();
        tableCheck.Tenant = `Exists (${tenantCount} tenants)`;
      } catch (err: any) {
        tableCheck.Tenant = `Error: ${err.message}`;
      }
    } catch (err: any) {
      dbError = err.message;
    }

    let redisConnected = false;
    let redisError = null;
    try {
      const ping = await this.redis.client.ping();
      if (ping === 'PONG') {
        redisConnected = true;
      }
    } catch (err: any) {
      redisError = err.message;
    }

    return {
      db: {
        connected: dbConnected,
        error: dbError,
        tables: tableCheck,
      },
      redis: {
        connected: redisConnected,
        error: redisError,
      },
      env: {
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL_SET: !!process.env.DATABASE_URL,
        REDIS_URL_SET: !!process.env.REDIS_URL,
        JWT_SECRET_SET: !!process.env.JWT_SECRET,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

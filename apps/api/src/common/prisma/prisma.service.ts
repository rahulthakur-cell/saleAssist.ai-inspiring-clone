import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, UserRole, TenantPlan, TenantStatus } from '@saleassist/database';
import * as bcrypt from 'bcrypt';

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

    // Check if the database has been initialized (e.g. check if the User table exists)
    let needsMigration = false;
    try {
      await this.$queryRawUnsafe('SELECT 1 FROM "User" LIMIT 1');
    } catch (err: any) {
      this.logger.warn('⚠️ User table check failed (database might be uninitialized): ' + err.message);
      needsMigration = true;
    }

    if (
      needsMigration ||
      process.env.NODE_ENV === 'production' ||
      process.env.RUN_AUTO_MIGRATION === 'true'
    ) {
      try {
        const path = require('path');
        const fs = require('fs');
        
        // Find the schema path dynamically
        const candidates = [
          path.resolve(process.cwd(), 'packages/database/prisma/schema.prisma'),
          path.resolve(__dirname, '../../../../packages/database/prisma/schema.prisma'),
          path.resolve(__dirname, '../../..', 'packages/database/prisma/schema.prisma'),
        ];
        
        let schemaPath = null;
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            schemaPath = candidate;
            break;
          }
        }

        if (!schemaPath) {
          throw new Error(`Could not find schema.prisma at any of the candidates: ${candidates.join(', ')}`);
        }

        this.logger.log(`🔄 Running database schema push programmatically using schema: ${schemaPath}`);
        const { execSync } = require('child_process');
        
        // Push the schema using prisma CLI
        const pushOutput = execSync(
          `npx prisma db push --schema="${schemaPath}" --accept-data-loss`,
          { stdio: 'pipe', encoding: 'utf-8' }
        );
        this.logger.log(`✅ Database schema push completed:\n${pushOutput}`);
      } catch (err: any) {
        this.logger.error('❌ Failed to push database schema:', err.message);
        if (err.stdout) this.logger.error(`Stdout: ${err.stdout}`);
        if (err.stderr) this.logger.error(`Stderr: ${err.stderr}`);
      }

      try {
        this.logger.log('🌱 Running database seeding programmatically...');
        await this.seedDatabase();
        this.logger.log('✅ Database seeding completed successfully.');
      } catch (err: any) {
        this.logger.error('❌ Failed to seed database:', err.message);
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('🔌 Database disconnected');
  }

  private async seedDatabase() {
    // Create super admin user
    const adminPasswordHash = await bcrypt.hash('admin123456', 12);
    const superAdmin = await this.user.upsert({
      where: { email: 'admin@saleassist.local' },
      update: {},
      create: {
        email: 'admin@saleassist.local',
        name: 'Super Admin',
        passwordHash: adminPasswordHash,
        emailVerified: new Date(),
        isSuperAdmin: true,
      },
    });
    this.logger.log(`[Seed] Super admin: ${superAdmin.email}`);

    // Create demo tenant
    const demoTenant = await this.tenant.upsert({
      where: { slug: 'demo' },
      update: {},
      create: {
        name: 'Demo Store',
        slug: 'demo',
        plan: TenantPlan.PROFESSIONAL,
        status: TenantStatus.ACTIVE,
        maxAgents: 10,
        maxMonthlyMinutes: 1000,
        maxStorageGb: 50,
        settings: {
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          language: 'en',
        },
      },
    });
    this.logger.log(`[Seed] Demo tenant: ${demoTenant.name} (${demoTenant.slug})`);

    // Link super admin to demo tenant as owner
    await this.tenantUser.upsert({
      where: {
        tenantId_userId: {
          tenantId: demoTenant.id,
          userId: superAdmin.id,
        },
      },
      update: {},
      create: {
        tenantId: demoTenant.id,
        userId: superAdmin.id,
        role: UserRole.TENANT_OWNER,
        isActive: true,
        isAvailable: true,
      },
    });

    // Create demo agent
    const agentPasswordHash = await bcrypt.hash('agent123456', 12);
    const demoAgent = await this.user.upsert({
      where: { email: 'agent@saleassist.local' },
      update: {},
      create: {
        email: 'agent@saleassist.local',
        name: 'Demo Agent',
        passwordHash: agentPasswordHash,
        emailVerified: new Date(),
      },
    });

    await this.tenantUser.upsert({
      where: {
        tenantId_userId: {
          tenantId: demoTenant.id,
          userId: demoAgent.id,
        },
      },
      update: {},
      create: {
        tenantId: demoTenant.id,
        userId: demoAgent.id,
        role: UserRole.AGENT,
        isActive: true,
        isAvailable: true,
      },
    });
    this.logger.log(`[Seed] Demo agent: ${demoAgent.email}`);

    // Create default widget config if not exists
    const existingWidget = await this.widgetConfig.findFirst({
      where: { tenantId: demoTenant.id },
    });
    if (!existingWidget) {
      await this.widgetConfig.create({
        data: {
          tenantId: demoTenant.id,
          name: 'Default Widget',
          isActive: true,
          primaryColor: '#6366f1',
          secondaryColor: '#8b5cf6',
          greeting: 'Hi! Welcome to our store. How can we help you today?',
          enableVideoCall: true,
          enableChat: true,
          enableShoppable: true,
          enableFaq: true,
          allowedDomains: ['localhost', '*.saleassist.local'],
        },
      });
      this.logger.log('[Seed] Default widget config created');
    }

    // Create sample custom role if not exists
    const existingRole = await this.customRole.findFirst({
      where: { tenantId: demoTenant.id, name: 'Sales Lead' },
    });
    if (!existingRole) {
      await this.customRole.create({
        data: {
          tenantId: demoTenant.id,
          name: 'Sales Lead',
          description: 'Can manage leads and contacts but not billing',
          permissions: [
            'video_call:create',
            'video_call:join',
            'video_call:view',
            'contact:create',
            'contact:view',
            'contact:edit',
            'lead:create',
            'lead:view',
            'lead:edit',
            'lead:assign',
            'deal:create',
            'deal:view',
            'deal:edit',
          ],
        },
      });
      this.logger.log('[Seed] Sample custom role created');
    }
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

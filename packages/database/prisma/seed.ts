import { PrismaClient, UserRole, TenantPlan, TenantStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('🌱 Seeding database...');

  // Create super admin user
  const adminPasswordHash = await hashPassword('admin123456');
  const superAdmin = await prisma.user.upsert({
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
  console.log(`✅ Super admin: ${superAdmin.email}`);

  // Create demo tenant
  const demoTenant = await prisma.tenant.upsert({
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
  console.log(`✅ Demo tenant: ${demoTenant.name} (${demoTenant.slug})`);

  // Link super admin to demo tenant as owner
  await prisma.tenantUser.upsert({
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
  const agentPasswordHash = await hashPassword('agent123456');
  const demoAgent = await prisma.user.upsert({
    where: { email: 'agent@saleassist.local' },
    update: {},
    create: {
      email: 'agent@saleassist.local',
      name: 'Demo Agent',
      passwordHash: agentPasswordHash,
      emailVerified: new Date(),
    },
  });

  await prisma.tenantUser.upsert({
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
  console.log(`✅ Demo agent: ${demoAgent.email}`);

  // Create default widget config if not exists
  const existingWidget = await prisma.widgetConfig.findFirst({
    where: { tenantId: demoTenant.id },
  });
  if (!existingWidget) {
    await prisma.widgetConfig.create({
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
    console.log('✅ Default widget config created');
  } else {
    console.log('ℹ️ Default widget config already exists');
  }

  // Create sample custom role if not exists
  const existingRole = await prisma.customRole.findFirst({
    where: {
      tenantId: demoTenant.id,
      name: 'Sales Lead',
    },
  });
  if (!existingRole) {
    await prisma.customRole.create({
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
    console.log('✅ Sample custom role created');
  } else {
    console.log('ℹ️ Sample custom role already exists');
  }

  console.log('\n🎉 Seed completed successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Admin login: admin@saleassist.local / admin123456');
  console.log('  Agent login: agent@saleassist.local / agent123456');
  console.log('  Tenant slug: demo');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

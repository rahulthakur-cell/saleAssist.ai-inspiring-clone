import { PrismaClient } from '@prisma/client';

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Creates a Prisma client with tenant context for RLS.
 * Call this at the beginning of each request to scope queries.
 */
export async function withTenantContext(tenantId: string) {
  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.current_tenant_id', '${tenantId}', true)`,
  );
  return prisma;
}

export { PrismaClient };
export default prisma;

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPlan, SubscriptionStatus, PaymentStatus, BillingProvider } from '@saleassist/database';
import { PosthogService } from '../analytics/posthog.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posthogService: PosthogService,
  ) {}

  /**
   * Retrieves active subscription, metered usage, and plan boundaries.
   */
  async getBillingOverview(tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    // Calculate current month's start
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Count current agents
    const agentsCount = await this.prisma.tenantUser.count({
      where: { tenantId },
    });

    // 2. Count current video call minutes used this month
    const callsAgg = await this.prisma.videoCall.aggregate({
      where: {
        tenantId,
        createdAt: { gte: startOfMonth },
        status: 'COMPLETED',
      },
      _sum: {
        durationSeconds: true,
      },
    });

    const secondsUsed = callsAgg._sum.durationSeconds || 0;
    const minutesUsed = Math.ceil(secondsUsed / 60);

    // 3. Count shoppable videos and mock storage size
    const videosCount = await this.prisma.shoppableVideo.count({
      where: { tenantId },
    });
    // 1 video ~= 50MB for simplicity, plus some fallback basic usage
    const storageUsedGb = parseFloat(((videosCount * 50) / 1024).toFixed(2)) || 0.15;

    // 4. Fetch subscription DB record
    let subscription = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    // Seed mock initial subscription if none exists
    if (!subscription) {
      subscription = await this.prisma.subscription.create({
        data: {
          tenantId,
          provider: BillingProvider.STRIPE,
          externalId: `sub_mock_${Math.random().toString(36).substring(7)}`,
          planId: tenant.plan.toLowerCase(),
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: startOfMonth,
          currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      });
    }

    return {
      plan: tenant.plan,
      status: tenant.status,
      limits: {
        maxAgents: tenant.maxAgents,
        maxMonthlyMinutes: tenant.maxMonthlyMinutes,
        maxStorageGb: tenant.maxStorageGb,
      },
      usage: {
        agentsCount,
        minutesUsed,
        storageUsedGb,
      },
      subscription: {
        id: subscription.id,
        externalId: subscription.externalId,
        status: subscription.status,
        planId: subscription.planId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    };
  }

  /**
   * Simulates checkout payment sessions and upgrades tenant plans.
   */
  async upgradePlan(tenantId: string, planName: TenantPlan): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    // Define limits corresponding to plans
    let maxAgents = 2;
    let maxMonthlyMinutes = 100;
    let maxStorageGb = 5;
    let price = 0;

    if (planName === TenantPlan.STARTER) {
      maxAgents = 5;
      maxMonthlyMinutes = 500;
      maxStorageGb = 25;
      price = 29;
    } else if (planName === TenantPlan.PROFESSIONAL) {
      maxAgents = 25;
      maxMonthlyMinutes = 2000;
      maxStorageGb = 100;
      price = 99;
    } else if (planName === TenantPlan.ENTERPRISE) {
      maxAgents = 9999;
      maxMonthlyMinutes = 99999;
      maxStorageGb = 1000;
      price = 299;
    }

    // 1. Update Tenant in DB
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan: planName,
        status: 'ACTIVE',
        maxAgents,
        maxMonthlyMinutes,
        maxStorageGb,
      },
    });

    const now = new Date();
    const currentPeriodStart = now;
    const currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // 2. Create/update Subscription
    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId,
        provider: BillingProvider.STRIPE,
        externalId: `sub_mock_${Math.random().toString(36).substring(7)}`,
        planId: planName.toLowerCase(),
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart,
        currentPeriodEnd,
      },
    });

    // 3. Create mock successful Invoice record
    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        provider: BillingProvider.STRIPE,
        externalId: `in_mock_${Math.random().toString(36).substring(7)}`,
        amount: price,
        currency: 'USD',
        status: PaymentStatus.SUCCEEDED,
        pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        paidAt: now,
      },
    });

    // Track event in PostHog
    this.posthogService.capture(
      tenantId,
      'plan_upgraded',
      {
        plan: planName,
        price,
        subscriptionId: subscription.id,
        tenantId,
      },
    ).catch(() => {});

    return {
      success: true,
      plan: planName,
      subscriptionId: subscription.id,
      invoiceId: invoice.id,
    };
  }

  /**
   * Fetches past mock payments list for the invoices log.
   */
  async getInvoices(tenantId: string): Promise<any[]> {
    await this.prisma.setTenantContext(tenantId);

    let invoices = await this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    // If invoices is empty, seed a dummy historical invoice to display something beautiful
    if (invoices.length === 0) {
      const pastMonth = new Date();
      pastMonth.setMonth(pastMonth.getMonth() - 1);
      
      const seedInvoice = await this.prisma.invoice.create({
        data: {
          tenantId,
          provider: BillingProvider.STRIPE,
          externalId: `in_mock_${Math.random().toString(36).substring(7)}`,
          amount: 29.00,
          currency: 'USD',
          status: PaymentStatus.SUCCEEDED,
          pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          paidAt: pastMonth,
          createdAt: pastMonth,
        },
      });
      invoices = [seedInvoice];
    }

    return invoices;
  }
}

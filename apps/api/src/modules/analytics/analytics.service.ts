import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VisitorEventType } from '@saleassist/database';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tracks a visitor event.
   */
  async trackEvent(tenantId: string, dto: {
    fingerprint: string;
    type: VisitorEventType;
    page?: string;
    referrer?: string;
    duration?: number;
    metadata?: any;
    visitorInfo?: {
      email?: string;
      name?: string;
      phone?: string;
      country?: string;
      city?: string;
      userAgent?: string;
      ip?: string;
    };
  }): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    // 1. Find or create visitor
    let visitor = await this.prisma.visitor.findUnique({
      where: {
        tenantId_fingerprint: {
          tenantId,
          fingerprint: dto.fingerprint,
        },
      },
    });

    const metadataMerged = {
      ...(visitor?.metadata as Record<string, any> || {}),
      ...(dto.metadata || {}),
    };

    if (!visitor) {
      visitor = await this.prisma.visitor.create({
        data: {
          tenantId,
          fingerprint: dto.fingerprint,
          email: dto.visitorInfo?.email || null,
          name: dto.visitorInfo?.name || null,
          phone: dto.visitorInfo?.phone || null,
          country: dto.visitorInfo?.country || 'Unknown',
          city: dto.visitorInfo?.city || 'Unknown',
          userAgent: dto.visitorInfo?.userAgent || null,
          ip: dto.visitorInfo?.ip || null,
          referrer: dto.referrer || null,
          metadata: metadataMerged,
        },
      });
    } else {
      // Update details if present
      visitor = await this.prisma.visitor.update({
        where: { id: visitor.id },
        data: {
          lastSeenAt: new Date(),
          email: dto.visitorInfo?.email || visitor.email,
          name: dto.visitorInfo?.name || visitor.name,
          phone: dto.visitorInfo?.phone || visitor.phone,
          metadata: metadataMerged,
        },
      });
    }

    // 2. Log Visitor Event
    return this.prisma.visitorEvent.create({
      data: {
        visitorId: visitor.id,
        type: dto.type,
        page: dto.page || null,
        referrer: dto.referrer || null,
        duration: dto.duration || null,
        metadata: dto.metadata || {},
      },
    });
  }

  /**
   * Compiles analytics overview stats for agent dashboard.
   */
  async getOverviewStats(tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get event count groupings
    const events = await this.prisma.visitorEvent.findMany({
      where: {
        visitor: { tenantId },
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        type: true,
        createdAt: true,
      },
    });

    const counts = {
      pageViews: 0,
      widgetOpens: 0,
      chatStarts: 0,
      videoCalls: 0,
      videoWatches: 0,
      productClicks: 0,
      formSubmits: 0,
    };

    events.forEach((ev) => {
      if (ev.type === VisitorEventType.PAGE_VIEW) counts.pageViews++;
      if (ev.type === VisitorEventType.WIDGET_OPEN) counts.widgetOpens++;
      if (ev.type === VisitorEventType.CHAT_START) counts.chatStarts++;
      if (ev.type === VisitorEventType.VIDEO_CALL_REQUEST) counts.videoCalls++;
      if (ev.type === VisitorEventType.VIDEO_WATCH) counts.videoWatches++;
      if (ev.type === VisitorEventType.PRODUCT_CLICK) counts.productClicks++;
      if (ev.type === VisitorEventType.FORM_SUBMIT) counts.formSubmits++;
    });

    // Compile daily timeline for the chart
    const dailyMap = new Map<string, { pageViews: number; interactions: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      dailyMap.set(key, { pageViews: 0, interactions: 0 });
    }

    events.forEach((ev) => {
      const key = ev.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (dailyMap.has(key)) {
        const item = dailyMap.get(key)!;
        if (ev.type === VisitorEventType.PAGE_VIEW) {
          item.pageViews++;
        } else {
          item.interactions++;
        }
      }
    });

    const chartData = Array.from(dailyMap.entries()).map(([date, val]) => ({
      date,
      views: val.pageViews,
      clicks: val.interactions,
    }));

    // Calculate CTR
    const totalViews = counts.pageViews || 1;
    const ctr = parseFloat(((counts.productClicks / totalViews) * 100).toFixed(2));

    return {
      summary: {
        ...counts,
        ctr,
      },
      chartData,
    };
  }

  /**
   * Lists recent visitors with their events timeline.
   */
  async getVisitorsList(tenantId: string, limit = 50): Promise<any[]> {
    await this.prisma.setTenantContext(tenantId);

    return this.prisma.visitor.findMany({
      where: { tenantId },
      include: {
        events: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { lastSeenAt: 'desc' },
      take: limit,
    });
  }
}

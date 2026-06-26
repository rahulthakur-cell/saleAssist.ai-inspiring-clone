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

    events.forEach((ev: { type: string; createdAt: Date }) => {
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

    events.forEach((ev: { type: string; createdAt: Date }) => {
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

  /**
   * Compiles dashboard stats for home page.
   */
  async getDashboardStats(tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    // 1. Total Video Calls
    const totalCalls = await this.prisma.videoCall.count({
      where: { tenantId }
    });

    // 2. Active Leads
    const activeLeads = await this.prisma.lead.count({
      where: {
        tenantId,
        status: {
          in: ['NEW', 'CONTACTED', 'QUALIFIED']
        }
      }
    });

    // 3. Revenue (Sum of CLOSED_WON deals)
    const closedWonDeals = await this.prisma.deal.findMany({
      where: {
        tenantId,
        stage: 'CLOSED_WON'
      },
      select: {
        value: true
      }
    });
    const revenue = closedWonDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);

    // 4. Avg. Call Duration (COMPLETED calls)
    const completedCalls = await this.prisma.videoCall.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        durationSeconds: { not: null }
      },
      select: {
        durationSeconds: true
      }
    });
    const totalDuration = completedCalls.reduce((sum, call) => sum + (call.durationSeconds || 0), 0);
    const avgCallDuration = completedCalls.length > 0 ? Math.round(totalDuration / completedCalls.length) : 0;

    // 5. Recent Activities (Union of recent records)
    const [recentCalls, recentLeads, recentDeals, recentContacts] = await Promise.all([
      this.prisma.videoCall.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 3
      }),
      this.prisma.lead.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 3
      }),
      this.prisma.deal.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 3
      }),
      this.prisma.contact.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 3
      })
    ]);

    const activities: any[] = [];

    recentCalls.forEach(call => {
      activities.push({
        id: `call-${call.id}`,
        type: 'video_call',
        title: `Video call with ${call.visitorName || 'Visitor'} (${call.status.toLowerCase()})`,
        time: call.createdAt,
        status: call.status.toLowerCase() === 'completed' ? 'completed' : 'missed',
        color: call.status === 'COMPLETED' ? 'bg-indigo-500' : 'bg-red-500'
      });
    });

    recentLeads.forEach(lead => {
      activities.push({
        id: `lead-${lead.id}`,
        type: 'lead',
        title: `New lead: ${lead.name || lead.email || 'Visitor'} (${lead.status.toLowerCase()})`,
        time: lead.createdAt,
        status: 'new',
        color: 'bg-emerald-500'
      });
    });

    recentDeals.forEach(deal => {
      activities.push({
        id: `deal-${deal.id}`,
        type: 'deal',
        title: `Deal "${deal.title}" stage is ${deal.stage.toLowerCase()}`,
        time: deal.createdAt,
        status: 'updated',
        color: 'bg-violet-500'
      });
    });

    recentContacts.forEach(contact => {
      activities.push({
        id: `contact-${contact.id}`,
        type: 'ai_chat',
        title: `New contact created: ${contact.firstName} ${contact.lastName || ''}`,
        time: contact.createdAt,
        status: 'completed',
        color: 'bg-cyan-500'
      });
    });

    // Sort activities by time desc, take top 6
    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    const recentActivities = activities.slice(0, 6);

    // 6. Top Agents
    const agents = await this.prisma.tenantUser.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            assignedLeads: true,
            videoCallParticipants: true
          }
        }
      },
      take: 4
    });

    const agentPerformance = agents.map(agent => {
      const initials = agent.user.name ? agent.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'AG';
      return {
        name: agent.user.name,
        calls: agent._count?.videoCallParticipants || 0,
        leads: agent._count?.assignedLeads || 0,
        rating: 4.8,
        avatar: initials
      };
    });

    return {
      stats: {
        totalCalls,
        activeLeads,
        revenue,
        avgCallDuration
      },
      recentActivities,
      agentPerformance
    };
  }
}

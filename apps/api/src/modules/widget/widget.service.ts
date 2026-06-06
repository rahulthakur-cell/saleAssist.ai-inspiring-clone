import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class WidgetService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves or initializes default widget configuration for a tenant.
   */
  async getOrCreateConfig(tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    let config = await this.prisma.widgetConfig.findFirst({
      where: { tenantId },
    });

    if (!config) {
      config = await this.prisma.widgetConfig.create({
        data: {
          tenantId,
          name: 'Default Widget',
          isActive: true,
          position: 'BOTTOM_RIGHT',
          primaryColor: '#6366f1',
          secondaryColor: '#8b5cf6',
          borderRadius: 16,
          greeting: 'Hi! How can we help you today?',
          enableVideoCall: true,
          enableChat: true,
          enableShoppable: true,
          enableFaq: true,
          allowedDomains: [],
          routingRules: {},
        },
      });
    }

    return config;
  }

  /**
   * Updates widget configuration for a tenant.
   */
  async updateConfig(tenantId: string, dto: any): Promise<any> {
    await this.prisma.setTenantContext(tenantId);
    
    const existing = await this.getOrCreateConfig(tenantId);

    return this.prisma.widgetConfig.update({
      where: { id: existing.id },
      data: {
        name: dto.name ?? existing.name,
        isActive: dto.isActive ?? existing.isActive,
        position: dto.position ?? existing.position,
        primaryColor: dto.primaryColor ?? existing.primaryColor,
        secondaryColor: dto.secondaryColor ?? existing.secondaryColor,
        borderRadius: typeof dto.borderRadius === 'number' ? dto.borderRadius : existing.borderRadius,
        greeting: dto.greeting ?? existing.greeting,
        logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : existing.logoUrl,
        enableVideoCall: dto.enableVideoCall ?? existing.enableVideoCall,
        enableChat: dto.enableChat ?? existing.enableChat,
        enableShoppable: dto.enableShoppable ?? existing.enableShoppable,
        enableFaq: dto.enableFaq ?? existing.enableFaq,
        allowedDomains: dto.allowedDomains ?? existing.allowedDomains,
        routingRules: dto.routingRules ?? existing.routingRules,
      },
    });
  }
}

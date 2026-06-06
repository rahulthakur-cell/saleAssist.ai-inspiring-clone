import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard, RbacGuard } from '../../common/guards';
import { RequirePermissions, TenantId, Public } from '../../common/decorators';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('events')
  @Public() // Allow public widget script trackers to log browser events
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log visitor interaction page event' })
  async trackEvent(
    @Body() body: any,
    @TenantId() tenantId: string,
    @Req() req: any,
  ): Promise<any> {
    // Fallback search order: header context, explicit query parameter, or body payload
    const resolvedTenantId = tenantId || req.query?.tenantId || body?.tenantId;
    if (!resolvedTenantId) {
      return { success: false, message: 'Tenant context is missing.' };
    }
    
    return this.analyticsService.trackEvent(resolvedTenantId, body);
  }

  @Get('overview')
  @RequirePermissions('video_call:view') // Agents dashboard view
  @ApiOperation({ summary: 'Retrieve dashboard overview metric aggregates' })
  async getOverview(@TenantId() tenantId: string): Promise<any> {
    return this.analyticsService.getOverviewStats(tenantId);
  }

  @Get('visitors')
  @RequirePermissions('video_call:view') // Agents dashboard view
  @ApiOperation({ summary: 'Retrieve timeline logs of recent store visitors' })
  async getVisitors(
    @TenantId() tenantId: string,
    @Query('limit') limit?: number,
  ): Promise<any> {
    return this.analyticsService.getVisitorsList(tenantId, limit ? Number(limit) : 50);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtAuthGuard, RbacGuard } from '../../common/guards';
import { RequirePermissions, TenantId } from '../../common/decorators';
import { TenantPlan } from '@saleassist/database';

@ApiTags('Billing')
@Controller('billing')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('subscription')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'Get current subscription details and usage stats' })
  async getSubscription(@TenantId() tenantId: string): Promise<any> {
    return this.billingService.getBillingOverview(tenantId);
  }

  @Post('upgrade')
  @RequirePermissions('settings:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Simulate updating the tenant subscription package' })
  async upgradePlan(
    @TenantId() tenantId: string,
    @Body('plan') planName: string,
  ): Promise<any> {
    if (!planName) {
      throw new BadRequestException('Plan parameter is required');
    }

    const upperPlan = planName.toUpperCase();
    if (!Object.values(TenantPlan).includes(upperPlan as TenantPlan)) {
      throw new BadRequestException(`Invalid plan value: ${planName}`);
    }

    return this.billingService.upgradePlan(tenantId, upperPlan as TenantPlan);
  }

  @Get('invoices')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'List recent billing invoices log' })
  async getInvoices(@TenantId() tenantId: string): Promise<any[]> {
    return this.billingService.getInvoices(tenantId);
  }
}

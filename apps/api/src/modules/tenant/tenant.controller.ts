import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { JwtAuthGuard, RbacGuard } from '../../common/guards';
import { CurrentUser, TenantId, RequirePermissions } from '../../common/decorators';

@ApiTags('Tenant')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current organization' })
  async getCurrentTenant(@TenantId() tenantId: string) {
    return this.tenantService.findById(tenantId);
  }

  @Patch('current')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'Update organization settings' })
  async updateTenant(@TenantId() tenantId: string, @Body() body: any): Promise<any> {
    return this.tenantService.update(tenantId, body);
  }

  @Get('current/usage')
  @ApiOperation({ summary: 'Get organization usage stats' })
  async getUsage(@TenantId() tenantId: string) {
    return this.tenantService.getUsage(tenantId);
  }

  @Delete('current')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'Delete organization (owner only)' })
  async deleteTenant(
    @TenantId() tenantId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.tenantService.delete(tenantId, userId);
  }

  @Get('api-keys')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'List organization API keys' })
  async listApiKeys(@TenantId() tenantId: string) {
    return this.tenantService.listApiKeys(tenantId);
  }

  @Post('api-keys')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'Create a new API key' })
  async createApiKey(
    @TenantId() tenantId: string,
    @Body() body: { name: string; permissions?: string[] },
  ) {
    return this.tenantService.createApiKey(tenantId, body);
  }

  @Delete('api-keys/:id')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'Revoke an API key' })
  async revokeApiKey(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.tenantService.revokeApiKey(tenantId, id);
  }
}

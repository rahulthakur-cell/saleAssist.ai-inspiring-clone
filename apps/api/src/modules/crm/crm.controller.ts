import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CrmService } from './crm.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { CreateDealDto, UpdateDealDto } from './dto/deal.dto';
import { CreateLeadDto, UpdateLeadDto } from './dto/lead.dto';
import { JwtAuthGuard, RbacGuard } from '../../common/guards';
import { TenantId, RequirePermissions } from '../../common/decorators';

// ─── Companies ──────────────────────────────────────────────────

@ApiTags('Companies')
@Controller('crm/companies')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class CompanyController {
  constructor(private readonly crmService: CrmService) {}

  @Get()
  @RequirePermissions('video_call:view')
  @ApiOperation({ summary: 'List all companies' })
  async list(
    @TenantId() tenantId: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<any> {
    return this.crmService.listCompanies(tenantId, {
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  @RequirePermissions('video_call:view')
  @ApiOperation({ summary: 'Get a single company' })
  async get(@TenantId() tenantId: string, @Param('id') id: string): Promise<any> {
    return this.crmService.getCompany(tenantId, id);
  }

  @Post()
  @RequirePermissions('video_call:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a company' })
  async create(@TenantId() tenantId: string, @Body() dto: CreateCompanyDto): Promise<any> {
    return this.crmService.createCompany(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('video_call:create')
  @ApiOperation({ summary: 'Update a company' })
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ): Promise<any> {
    return this.crmService.updateCompany(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('video_call:create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a company' })
  async remove(@TenantId() tenantId: string, @Param('id') id: string): Promise<any> {
    return this.crmService.deleteCompany(tenantId, id);
  }
}

// ─── Deals ──────────────────────────────────────────────────────

@ApiTags('Deals')
@Controller('crm/deals')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class DealController {
  constructor(private readonly crmService: CrmService) {}

  @Get()
  @RequirePermissions('video_call:view')
  @ApiOperation({ summary: 'List all deals (with stage grouping)' })
  async list(
    @TenantId() tenantId: string,
    @Query('search') search?: string,
    @Query('stage') stage?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<any> {
    return this.crmService.listDeals(tenantId, {
      search,
      stage,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get(':id')
  @RequirePermissions('video_call:view')
  @ApiOperation({ summary: 'Get a single deal' })
  async get(@TenantId() tenantId: string, @Param('id') id: string): Promise<any> {
    return this.crmService.getDeal(tenantId, id);
  }

  @Post()
  @RequirePermissions('video_call:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a deal' })
  async create(@TenantId() tenantId: string, @Body() dto: CreateDealDto): Promise<any> {
    return this.crmService.createDeal(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('video_call:create')
  @ApiOperation({ summary: 'Update a deal' })
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDealDto,
  ): Promise<any> {
    return this.crmService.updateDeal(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('video_call:create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a deal' })
  async remove(@TenantId() tenantId: string, @Param('id') id: string): Promise<any> {
    return this.crmService.deleteDeal(tenantId, id);
  }
}

// ─── Leads ──────────────────────────────────────────────────────

@ApiTags('Leads')
@Controller('leads')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class LeadController {
  constructor(private readonly crmService: CrmService) {}

  @Get()
  @RequirePermissions('video_call:view')
  @ApiOperation({ summary: 'List all leads' })
  async list(
    @TenantId() tenantId: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<any> {
    return this.crmService.listLeads(tenantId, {
      search,
      status,
      source,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  @RequirePermissions('video_call:view')
  @ApiOperation({ summary: 'Get a single lead' })
  async get(@TenantId() tenantId: string, @Param('id') id: string): Promise<any> {
    return this.crmService.getLead(tenantId, id);
  }

  @Post()
  @RequirePermissions('video_call:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a lead' })
  async create(@TenantId() tenantId: string, @Body() dto: CreateLeadDto): Promise<any> {
    return this.crmService.createLead(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('video_call:create')
  @ApiOperation({ summary: 'Update a lead' })
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ): Promise<any> {
    return this.crmService.updateLead(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('video_call:create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a lead' })
  async remove(@TenantId() tenantId: string, @Param('id') id: string): Promise<any> {
    return this.crmService.deleteLead(tenantId, id);
  }
}

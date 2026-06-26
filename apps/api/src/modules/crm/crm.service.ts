import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { CreateDealDto, UpdateDealDto } from './dto/deal.dto';
import { CreateLeadDto, UpdateLeadDto } from './dto/lead.dto';
import { Prisma, DealStage, LeadStatus, LeadSource } from '@saleassist/database';

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── COMPANIES ───────────────────────────────────────────

  async listCompanies(
    tenantId: string,
    opts: { search?: string; page?: number; limit?: number } = {},
  ) {
    await this.prisma.setTenantContext(tenantId);
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(100, opts.limit || 20);
    const skip = (page - 1) * limit;

    const where: Prisma.CompanyWhereInput = { tenantId };
    if (opts.search) {
      where.OR = [
        { name: { contains: opts.search, mode: 'insensitive' } },
        { domain: { contains: opts.search, mode: 'insensitive' } },
        { industry: { contains: opts.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { contacts: true, deals: true } },
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getCompany(tenantId: string, id: string) {
    await this.prisma.setTenantContext(tenantId);
    const company = await this.prisma.company.findFirst({
      where: { id, tenantId },
      include: {
        contacts: { take: 10, orderBy: { createdAt: 'desc' } },
        deals: { take: 10, orderBy: { createdAt: 'desc' } },
        _count: { select: { contacts: true, deals: true } },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async createCompany(tenantId: string, dto: CreateCompanyDto) {
    await this.prisma.setTenantContext(tenantId);
    return this.prisma.company.create({
      data: {
        tenantId,
        name: dto.name,
        domain: dto.domain,
        industry: dto.industry,
        size: dto.size,
        logo: dto.logo,
      },
    });
  }

  async updateCompany(tenantId: string, id: string, dto: UpdateCompanyDto) {
    await this.prisma.setTenantContext(tenantId);
    const company = await this.prisma.company.findFirst({ where: { id, tenantId } });
    if (!company) throw new NotFoundException('Company not found');

    return this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.domain !== undefined && { domain: dto.domain }),
        ...(dto.industry !== undefined && { industry: dto.industry }),
        ...(dto.size !== undefined && { size: dto.size }),
        ...(dto.logo !== undefined && { logo: dto.logo }),
      },
    });
  }

  async deleteCompany(tenantId: string, id: string) {
    await this.prisma.setTenantContext(tenantId);
    const company = await this.prisma.company.findFirst({ where: { id, tenantId } });
    if (!company) throw new NotFoundException('Company not found');
    await this.prisma.company.delete({ where: { id } });
    return { message: 'Company deleted' };
  }

  // ─── DEALS ───────────────────────────────────────────────

  async listDeals(
    tenantId: string,
    opts: { search?: string; stage?: string; page?: number; limit?: number } = {},
  ) {
    await this.prisma.setTenantContext(tenantId);
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(100, opts.limit || 50);
    const skip = (page - 1) * limit;

    const where: Prisma.DealWhereInput = { tenantId };
    if (opts.stage) {
      where.stage = opts.stage as DealStage;
    }
    if (opts.search) {
      where.OR = [{ title: { contains: opts.search, mode: 'insensitive' } }];
    }

    const [data, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          owner: { select: { id: true, user: { select: { name: true, email: true } } } },
          contacts: {
            include: { contact: { select: { id: true, firstName: true, lastName: true } } },
            take: 3,
          },
        },
      }),
      this.prisma.deal.count({ where }),
    ]);

    // Group deals by stage for kanban view
    const byStage: Record<string, typeof data> = {
      PROSPECTING: [],
      QUALIFICATION: [],
      PROPOSAL: [],
      NEGOTIATION: [],
      CLOSED_WON: [],
      CLOSED_LOST: [],
    };
    data.forEach((d) => {
      if (byStage[d.stage]) byStage[d.stage].push(d);
    });

    return { data, byStage, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getDeal(tenantId: string, id: string) {
    await this.prisma.setTenantContext(tenantId);
    const deal = await this.prisma.deal.findFirst({
      where: { id, tenantId },
      include: {
        company: true,
        owner: { select: { id: true, user: { select: { name: true, email: true } } } },
        contacts: { include: { contact: true } },
        activities: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async createDeal(tenantId: string, dto: CreateDealDto) {
    await this.prisma.setTenantContext(tenantId);
    return this.prisma.deal.create({
      data: {
        tenantId,
        title: dto.title,
        value: dto.value,
        currency: dto.currency || 'USD',
        stage: (dto.stage as DealStage) || 'PROSPECTING',
        probability: dto.probability || 0,
        expectedCloseAt: dto.expectedCloseAt ? new Date(dto.expectedCloseAt) : undefined,
        companyId: dto.companyId || undefined,
        ownerId: dto.ownerId || undefined,
      },
      include: {
        company: { select: { id: true, name: true } },
      },
    });
  }

  async updateDeal(tenantId: string, id: string, dto: UpdateDealDto) {
    await this.prisma.setTenantContext(tenantId);
    const deal = await this.prisma.deal.findFirst({ where: { id, tenantId } });
    if (!deal) throw new NotFoundException('Deal not found');

    return this.prisma.deal.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.stage !== undefined && { stage: dto.stage as DealStage }),
        ...(dto.probability !== undefined && { probability: dto.probability }),
        ...(dto.expectedCloseAt !== undefined && {
          expectedCloseAt: dto.expectedCloseAt ? new Date(dto.expectedCloseAt) : null,
        }),
        ...(dto.companyId !== undefined && { companyId: dto.companyId || null }),
        ...(dto.ownerId !== undefined && { ownerId: dto.ownerId || null }),
      },
      include: {
        company: { select: { id: true, name: true } },
      },
    });
  }

  async deleteDeal(tenantId: string, id: string) {
    await this.prisma.setTenantContext(tenantId);
    const deal = await this.prisma.deal.findFirst({ where: { id, tenantId } });
    if (!deal) throw new NotFoundException('Deal not found');
    await this.prisma.deal.delete({ where: { id } });
    return { message: 'Deal deleted' };
  }

  // ─── LEADS ───────────────────────────────────────────────

  async listLeads(
    tenantId: string,
    opts: { search?: string; status?: string; source?: string; page?: number; limit?: number } = {},
  ) {
    await this.prisma.setTenantContext(tenantId);
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(100, opts.limit || 20);
    const skip = (page - 1) * limit;

    const where: Prisma.LeadWhereInput = { tenantId };
    if (opts.status) where.status = opts.status as LeadStatus;
    if (opts.source) where.source = opts.source as LeadSource;
    if (opts.search) {
      where.OR = [
        { name: { contains: opts.search, mode: 'insensitive' } },
        { email: { contains: opts.search, mode: 'insensitive' } },
        { phone: { contains: opts.search, mode: 'insensitive' } },
        { company: { contains: opts.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedTo: { select: { id: true, user: { select: { name: true, email: true } } } },
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getLead(tenantId: string, id: string) {
    await this.prisma.setTenantContext(tenantId);
    const lead = await this.prisma.lead.findFirst({
      where: { id, tenantId },
      include: {
        assignedTo: { select: { id: true, user: { select: { name: true, email: true } } } },
        contact: true,
        videoCall: { select: { id: true, status: true, visitorName: true, createdAt: true } },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async createLead(tenantId: string, dto: CreateLeadDto) {
    await this.prisma.setTenantContext(tenantId);
    return this.prisma.lead.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        company: dto.company,
        message: dto.message,
        source: (dto.source as LeadSource) || 'MANUAL',
        status: (dto.status as LeadStatus) || 'NEW',
        score: dto.score || 0,
        assignedToId: dto.assignedToId || undefined,
      },
    });
  }

  async updateLead(tenantId: string, id: string, dto: UpdateLeadDto) {
    await this.prisma.setTenantContext(tenantId);
    const lead = await this.prisma.lead.findFirst({ where: { id, tenantId } });
    if (!lead) throw new NotFoundException('Lead not found');

    return this.prisma.lead.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.message !== undefined && { message: dto.message }),
        ...(dto.source !== undefined && { source: dto.source as LeadSource }),
        ...(dto.status !== undefined && {
          status: dto.status as LeadStatus,
          ...(dto.status === 'QUALIFIED' && { qualifiedAt: new Date() }),
          ...(dto.status === 'CONVERTED' && { convertedAt: new Date() }),
        }),
        ...(dto.score !== undefined && { score: dto.score }),
        ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId || null }),
      },
    });
  }

  async deleteLead(tenantId: string, id: string) {
    await this.prisma.setTenantContext(tenantId);
    const lead = await this.prisma.lead.findFirst({ where: { id, tenantId } });
    if (!lead) throw new NotFoundException('Lead not found');
    await this.prisma.lead.delete({ where: { id } });
    return { message: 'Lead deleted' };
  }
}

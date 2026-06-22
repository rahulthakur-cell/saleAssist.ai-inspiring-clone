import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';
import { Prisma, LeadSource } from '@saleassist/database';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateContactDto) {
    await this.prisma.setTenantContext(tenantId);

    // Check for duplicate email within tenant
    if (dto.email) {
      const existing = await this.prisma.contact.findFirst({
        where: { tenantId, email: dto.email },
      });
      if (existing) throw new ConflictException('A contact with this email already exists');
    }

    return this.prisma.contact.create({
      data: {
        tenantId,
        email: dto.email,
        phone: dto.phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
        avatar: dto.avatar,
        title: dto.title,
        companyId: dto.companyId || null,
        source: dto.source,
        tags: dto.tags || [],
        customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
      },
      include: { company: { select: { id: true, name: true } } },
    });
  }

  async findAll(tenantId: string, opts: { search?: string; source?: string; page?: number; limit?: number }) {
    await this.prisma.setTenantContext(tenantId);

    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(100, opts.limit || 20);
    const offset = (page - 1) * limit;

    const where: Prisma.ContactWhereInput = { tenantId };

    if (opts.search) {
      const s = opts.search;
      where.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
        { title: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (opts.source) {
      where.source = opts.source as any;
    }

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { company: { select: { id: true, name: true } } },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(tenantId: string, id: string) {
    await this.prisma.setTenantContext(tenantId);

    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
      include: {
        company: { select: { id: true, name: true, domain: true } },
        leads: { orderBy: { createdAt: 'desc' }, take: 5 },
        activities: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async update(tenantId: string, id: string, dto: UpdateContactDto) {
    await this.prisma.setTenantContext(tenantId);

    const contact = await this.prisma.contact.findFirst({ where: { id, tenantId } });
    if (!contact) throw new NotFoundException('Contact not found');

    if (dto.email && dto.email !== contact.email) {
      const duplicate = await this.prisma.contact.findFirst({
        where: { tenantId, email: dto.email, id: { not: id } },
      });
      if (duplicate) throw new ConflictException('A contact with this email already exists');
    }

    const updateData: Prisma.ContactUpdateInput = {};
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.avatar !== undefined) updateData.avatar = dto.avatar;
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.source !== undefined) updateData.source = dto.source as LeadSource;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.customFields !== undefined) updateData.customFields = dto.customFields as Prisma.InputJsonValue;
    if (dto.companyId !== undefined) {
      updateData.company = dto.companyId
        ? { connect: { id: dto.companyId } }
        : { disconnect: true };
    }

    return this.prisma.contact.update({
      where: { id },
      data: updateData,
      include: { company: { select: { id: true, name: true } } },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.prisma.setTenantContext(tenantId);

    const contact = await this.prisma.contact.findFirst({ where: { id, tenantId } });
    if (!contact) throw new NotFoundException('Contact not found');

    await this.prisma.contact.delete({ where: { id } });
    return { message: 'Contact deleted' };
  }
}

import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';
import { JwtAuthGuard, RbacGuard } from '../../common/guards';
import { TenantId, RequirePermissions } from '../../common/decorators';

@ApiTags('Contacts')
@Controller('contacts')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @RequirePermissions('video_call:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a contact' })
  async create(@TenantId() tenantId: string, @Body() dto: CreateContactDto): Promise<any> {
    return this.contactService.create(tenantId, dto);
  }

  @Get()
  @RequirePermissions('video_call:view')
  @ApiOperation({ summary: 'List all contacts with search & pagination' })
  async findAll(
    @TenantId() tenantId: string,
    @Query('search') search?: string,
    @Query('source') source?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<any> {
    return this.contactService.findAll(tenantId, {
      search,
      source,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  @RequirePermissions('video_call:view')
  @ApiOperation({ summary: 'Get a single contact' })
  async findOne(@TenantId() tenantId: string, @Param('id') id: string): Promise<any> {
    return this.contactService.findOne(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions('video_call:create')
  @ApiOperation({ summary: 'Update a contact' })
  async update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateContactDto): Promise<any> {
    return this.contactService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('video_call:create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a contact' })
  async remove(@TenantId() tenantId: string, @Param('id') id: string): Promise<any> {
    return this.contactService.remove(tenantId, id);
  }
}

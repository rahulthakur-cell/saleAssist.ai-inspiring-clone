import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VideoFaqService } from './video-faq.service';
import { CreateFaqDto, CreateFaqItemDto } from './dto/create-faq.dto';
import { JwtAuthGuard, RbacGuard } from '../../common/guards';
import { Public, TenantId, RequirePermissions } from '../../common/decorators';

@ApiTags('Video FAQ')
@Controller('video-faqs')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class VideoFaqController {
  constructor(private readonly videoFaqService: VideoFaqService) {}

  @Post()
  @RequirePermissions('settings:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new Video FAQ collection' })
  async createFaq(@TenantId() tenantId: string, @Body() dto: CreateFaqDto): Promise<any> {
    return this.videoFaqService.createFaq(tenantId, dto);
  }

  @Post(':id/items')
  @RequirePermissions('settings:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a Video FAQ Item to a collection' })
  async addFaqItem(
    @Param('id') faqId: string,
    @TenantId() tenantId: string,
    @Body() dto: CreateFaqItemDto,
  ): Promise<any> {
    return this.videoFaqService.addFaqItem(faqId, tenantId, dto);
  }

  @Get()
  @Public() // Allow public widget access
  @ApiOperation({ summary: 'List FAQ collections and questions' })
  async listFaqs(@TenantId() tenantId: string): Promise<any> {
    return this.videoFaqService.listFaqs(tenantId);
  }

  @Delete(':id')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'Delete a Video FAQ collection' })
  async deleteFaq(@Param('id') faqId: string, @TenantId() tenantId: string): Promise<any> {
    return this.videoFaqService.deleteFaq(faqId, tenantId);
  }

  @Delete(':id/items/:iid')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'Delete a specific FAQ Item' })
  async deleteFaqItem(
    @Param('id') faqId: string,
    @Param('iid') itemId: string,
    @TenantId() tenantId: string,
  ): Promise<any> {
    return this.videoFaqService.deleteFaqItem(faqId, itemId, tenantId);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateFaqDto, CreateFaqItemDto } from './dto/create-faq.dto';
import { VideoFaqStatus } from '@saleassist/database';
import { SearchService } from '../search/search.service';

@Injectable()
export class VideoFaqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  /**
   * Creates a new Video FAQ collection.
   */
  async createFaq(tenantId: string, dto: CreateFaqDto): Promise<any> {
    await this.prisma.setTenantContext(tenantId);
    return this.prisma.videoFaq.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description || null,
        status: VideoFaqStatus.PUBLISHED, // Auto-publish for simple dev
        displayOrder: 0,
      },
    });
  }

  /**
   * Adds a Video FAQ Item to a collection.
   */
  async addFaqItem(faqId: string, tenantId: string, dto: CreateFaqItemDto): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const faq = await this.prisma.videoFaq.findFirst({
      where: { id: faqId, tenantId },
    });

    if (!faq) throw new NotFoundException('Video FAQ collection not found');

    const defaultThumbnail = 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=600&auto=format&fit=crop&q=60';

    const item = await this.prisma.videoFaqItem.create({
      data: {
        faqId,
        question: dto.question,
        videoUrl: dto.videoUrl,
        thumbnailUrl: dto.thumbnailUrl || defaultThumbnail,
        duration: 15, // Mocked 15 seconds response duration
        displayOrder: 0,
      },
    });

    // Sync to Meilisearch
    await this.searchService.syncDocument(tenantId, {
      id: `faq_${item.id}`,
      originalId: item.id,
      type: 'faq',
      title: item.question,
      description: `FAQ Playlist: ${faq.title}. Video Answer.`,
      url: '/video-faq',
    });

    return item;
  }

  /**
   * Lists FAQ collections for a tenant.
   */
  async listFaqs(tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);
    return this.prisma.videoFaq.findMany({
      where: { tenantId },
      orderBy: { displayOrder: 'asc' },
      include: {
        items: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  }

  /**
   * Deletes an FAQ collection.
   */
  async deleteFaq(faqId: string, tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const faq = await this.prisma.videoFaq.findFirst({
      where: { id: faqId, tenantId },
      include: { items: true },
    });

    if (!faq) throw new NotFoundException('Video FAQ collection not found');

    const deleted = await this.prisma.videoFaq.delete({
      where: { id: faqId },
    });

    // Delete items from Meilisearch
    for (const item of faq.items) {
      await this.searchService.deleteDocument(`faq_${item.id}`);
    }

    return deleted;
  }

  /**
   * Deletes a specific FAQ Item.
   */
  async deleteFaqItem(faqId: string, itemId: string, tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const faq = await this.prisma.videoFaq.findFirst({
      where: { id: faqId, tenantId },
    });

    if (!faq) throw new NotFoundException('Video FAQ collection not found');

    const item = await this.prisma.videoFaqItem.findFirst({
      where: { id: itemId, faqId },
    });

    if (!item) throw new NotFoundException('FAQ Item not found');

    const deleted = await this.prisma.videoFaqItem.delete({
      where: { id: itemId },
    });

    // Delete item from Meilisearch
    await this.searchService.deleteDocument(`faq_${itemId}`);

    return deleted;
  }
}

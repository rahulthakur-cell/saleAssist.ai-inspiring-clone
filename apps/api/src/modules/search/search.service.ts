import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch, Index } from 'meilisearch';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: MeiliSearch | null = null;
  private readonly indexName = 'global-search';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const url = this.configService.get<string>('MEILISEARCH_URL', 'http://localhost:7700');
    const apiKey = this.configService.get<string>('MEILISEARCH_API_KEY', 'masterKey_dev_change_in_production');

    try {
      this.client = new MeiliSearch({ host: url, apiKey });
      
      // Ensure index exists and configure filterable attributes
      const index = this.client.index(this.indexName);
      await this.client.createIndex(this.indexName, { primaryKey: 'id' }).catch(() => {
        // Index already exists
      });

      await index.updateFilterableAttributes(['tenantId', 'type']);
      this.logger.log(`Meilisearch initialized and configured filterable attributes on index: "${this.indexName}"`);
    } catch (err: any) {
      this.logger.warn(`Failed to connect to Meilisearch server: ${err.message}. Search operations will bypass.`);
    }
  }

  private getIndex(): Index<any> | null {
    if (!this.client) return null;
    return this.client.index(this.indexName);
  }

  /**
   * Reindexes all searchable models for a given tenant.
   */
  async reindexAll(tenantId: string): Promise<any> {
    const index = this.getIndex();
    if (!index) return { success: false, message: 'Meilisearch offline' };

    await this.prisma.setTenantContext(tenantId);

    const documents: any[] = [];

    // 1. Fetch Shoppable Videos
    const videos = await this.prisma.shoppableVideo.findMany({ where: { tenantId } });
    videos.forEach((vid) => {
      documents.push({
        id: `video_${vid.id}`,
        originalId: vid.id,
        tenantId,
        type: 'video',
        title: vid.title,
        description: vid.description || 'Interactive shoppable product video.',
        url: `/shoppable-videos/${vid.id}`,
      });
    });

    // 2. Fetch Video FAQs Questions
    const faqs = await this.prisma.videoFaq.findMany({
      where: { tenantId },
      include: { items: true },
    });
    faqs.forEach((faq) => {
      faq.items.forEach((item) => {
        documents.push({
          id: `faq_${item.id}`,
          originalId: item.id,
          tenantId,
          type: 'faq',
          title: item.question,
          description: `FAQ Playlist: ${faq.title}. Video Answer.`,
          url: '/video-faq',
        });
      });
    });

    // 3. Fetch CRM Contacts
    const contacts = await this.prisma.contact.findMany({ where: { tenantId } });
    contacts.forEach((c) => {
      documents.push({
        id: `contact_${c.id}`,
        originalId: c.id,
        tenantId,
        type: 'contact',
        title: `${c.firstName} ${c.lastName || ''}`.trim(),
        description: `Email: ${c.email || 'None'} • Phone: ${c.phone || 'None'}`,
        url: '/crm/contacts',
      });
    });

    // 4. Fetch CRM Leads
    const leads = await this.prisma.lead.findMany({ where: { tenantId } });
    leads.forEach((l) => {
      documents.push({
        id: `lead_${l.id}`,
        originalId: l.id,
        tenantId,
        type: 'lead',
        title: l.name || 'Unassigned Lead',
        description: `Source: ${l.source} • Status: ${l.status} • Email: ${l.email || 'None'}`,
        url: '/leads',
      });
    });

    // Clean existing entries for this tenant first (if index supports query deletion)
    try {
      await index.deleteDocuments({
        filter: `tenantId = "${tenantId}"`,
      });
    } catch {
      // In case filter delete fails or is unsupported in dev meilisearch version
    }

    if (documents.length > 0) {
      await index.addDocuments(documents);
    }

    return {
      success: true,
      indexedCount: documents.length,
    };
  }

  /**
   * Searches the global index.
   */
  async search(tenantId: string, query: string): Promise<any[]> {
    const index = this.getIndex();
    if (!index || !query.trim()) return [];

    try {
      const res = await index.search(query, {
        filter: `tenantId = "${tenantId}"`,
        limit: 20,
      });
      return res.hits;
    } catch (err: any) {
      this.logger.error(`Search failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Syncs a single document index record (add or update).
   */
  async syncDocument(tenantId: string, doc: {
    id: string;
    originalId: string;
    type: 'video' | 'faq' | 'contact' | 'lead';
    title: string;
    description: string;
    url: string;
  }): Promise<void> {
    const index = this.getIndex();
    if (!index) return;

    try {
      await index.addDocuments([{
        id: doc.id,
        originalId: doc.originalId,
        tenantId,
        type: doc.type,
        title: doc.title,
        description: doc.description,
        url: doc.url,
      }]);
    } catch (err: any) {
      this.logger.warn(`Document index sync failed: ${err.message}`);
    }
  }

  /**
   * Deletes a single document index record.
   */
  async deleteDocument(id: string): Promise<void> {
    const index = this.getIndex();
    if (!index) return;

    try {
      await index.deleteDocument(id);
    } catch (err: any) {
      this.logger.warn(`Document index deletion failed: ${err.message}`);
    }
  }
}

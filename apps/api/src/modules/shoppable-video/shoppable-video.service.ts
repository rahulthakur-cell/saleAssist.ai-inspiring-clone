import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateVideoDto, UpdateVideoDto, CreateHotspotDto } from './dto/create-video.dto';
import { ShoppableVideoStatus } from '@saleassist/database';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SearchService } from '../search/search.service';

@Injectable()
export class ShoppableVideoService {
  private readonly logger = new Logger(ShoppableVideoService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('video-transcode') private readonly videoQueue: Queue,
    private readonly searchService: SearchService,
  ) {}

  /**
   * Creates a draft Shoppable Video and triggers transcoding background job.
   */
  async createVideo(tenantId: string, dto: CreateVideoDto): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const video = await this.prisma.shoppableVideo.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description || null,
        videoUrl: dto.videoUrl,
        thumbnailUrl: dto.thumbnailUrl || null,
        status: ShoppableVideoStatus.PROCESSING, // Automatically set to processing
        displayType: dto.displayType || 'carousel',
        autoplay: dto.autoplay || false,
        loop: dto.loop || true,
        muted: dto.muted || true,
        metadata: {},
      },
    });

    // Queue transcode job in BullMQ
    try {
      await this.videoQueue.add(
        'transcode',
        {
          videoId: video.id,
          tenantId,
          videoUrl: video.videoUrl,
        },
        {
          attempts: 3,
          backoff: 5000,
        },
      );
      this.logger.log(`Queued video transcoding task for video ID: ${video.id}`);
    } catch (error: any) {
      this.logger.error(`Failed to queue video transcode: ${error.message}`);
      // Fallback: update status to draft so user is not stuck in PROCESSING forever
      await this.prisma.shoppableVideo.update({
        where: { id: video.id },
        data: { status: ShoppableVideoStatus.DRAFT },
      });
    }

    // Sync to Meilisearch
    await this.searchService.syncDocument(tenantId, {
      id: `video_${video.id}`,
      originalId: video.id,
      type: 'video',
      title: video.title,
      description: video.description || 'Interactive shoppable product video.',
      url: `/shoppable-videos/${video.id}`,
    });

    return video;
  }

  /**
   * Updates shoppable video details.
   */
  async updateVideo(videoId: string, tenantId: string, dto: UpdateVideoDto): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const video = await this.prisma.shoppableVideo.findFirst({
      where: { id: videoId, tenantId },
    });

    if (!video) throw new NotFoundException('Shoppable video not found');

    const updateData: any = { ...dto };
    if (dto.status) {
      updateData.status = dto.status as ShoppableVideoStatus;
    }

    return this.prisma.shoppableVideo.update({
      where: { id: videoId },
      data: updateData,
    });
  }

  /**
   * Lists shoppable videos for a tenant.
   */
  async listVideos(tenantId: string, limit = 20, page = 1): Promise<any> {
    await this.prisma.setTenantContext(tenantId);
    const offset = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.shoppableVideo.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          hotspots: true,
        },
      }),
      this.prisma.shoppableVideo.count({
        where: { tenantId },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Gets details of a specific video.
   */
  async getVideo(videoId: string, tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const video = await this.prisma.shoppableVideo.findFirst({
      where: { id: videoId, tenantId },
      include: {
        hotspots: {
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!video) throw new NotFoundException('Shoppable video not found');

    return video;
  }

  /**
   * Deletes a shoppable video.
   */
  async deleteVideo(videoId: string, tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const video = await this.prisma.shoppableVideo.findFirst({
      where: { id: videoId, tenantId },
    });

    if (!video) throw new NotFoundException('Shoppable video not found');

    const deleted = await this.prisma.shoppableVideo.delete({
      where: { id: videoId },
    });

    // Delete from Meilisearch
    await this.searchService.deleteDocument(`video_${videoId}`);

    return deleted;
  }

  /**
   * Adds a product hotspot.
   */
  async addHotspot(videoId: string, tenantId: string, dto: CreateHotspotDto): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const video = await this.prisma.shoppableVideo.findFirst({
      where: { id: videoId, tenantId },
    });

    if (!video) throw new NotFoundException('Shoppable video not found');

    return this.prisma.videoHotspot.create({
      data: {
        videoId,
        productName: dto.productName,
        productUrl: dto.productUrl,
        productImage: dto.productImage || null,
        price: dto.price || null,
        currency: dto.currency || 'USD',
        startTime: dto.startTime,
        endTime: dto.endTime,
        posX: dto.posX || null,
        posY: dto.posY || null,
        width: dto.width || null,
        height: dto.height || null,
      },
    });
  }

  /**
   * Deletes a product hotspot.
   */
  async deleteHotspot(videoId: string, hotspotId: string, tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const video = await this.prisma.shoppableVideo.findFirst({
      where: { id: videoId, tenantId },
    });

    if (!video) throw new NotFoundException('Shoppable video not found');

    const hotspot = await this.prisma.videoHotspot.findFirst({
      where: { id: hotspotId, videoId },
    });

    if (!hotspot) throw new NotFoundException('Hotspot not found');

    return this.prisma.videoHotspot.delete({
      where: { id: hotspotId },
    });
  }
}

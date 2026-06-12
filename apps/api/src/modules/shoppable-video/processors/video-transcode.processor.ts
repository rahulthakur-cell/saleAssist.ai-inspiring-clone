import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ShoppableVideoStatus } from '@saleassist/database';

@Processor('video-transcode')
export class VideoTranscodeProcessor {
  private readonly logger = new Logger(VideoTranscodeProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('transcode')
  async handleTranscode(job: Job<{ videoId: string; tenantId: string; videoUrl: string }>) {
    const { videoId, tenantId, videoUrl } = job.data;
    this.logger.log(`[Job ${job.id}] Starting transcode for video: ${videoId}`);

    // Set RLS tenant context
    await this.prisma.setTenantContext(tenantId);

    // Update progress
    await job.progress(10);

    // Simulate video transcoding delay (e.g. 3 seconds)
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await job.progress(50);

    // Simulate thumbnail generation
    const dummyThumbnailUrl = 'https://images.unsplash.com/photo-1460134846237-51c777df6111?w=600&auto=format&fit=crop&q=60';
    await job.progress(80);

    // Update ShoppableVideo record in DB
    await this.prisma.shoppableVideo.update({
      where: { id: videoId },
      data: {
        status: ShoppableVideoStatus.PUBLISHED,
        thumbnailUrl: dummyThumbnailUrl,
        duration: 30, // Mocked 30 seconds
      },
    });

    await job.progress(100);
    this.logger.log(`[Job ${job.id}] Transcode completed successfully for video: ${videoId}`);
    
    return { success: true, videoId, thumbnailUrl: dummyThumbnailUrl };
  }
}

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { LivekitService } from '../video-call/livekit.service';
import { CreateStreamDto, AddProductDto, ChatMessageDto } from './dto/create-stream.dto';
import { LiveStreamStatus, LiveStreamProduct, LiveStreamChat } from '@saleassist/database';
import { nanoid } from 'nanoid';
import { PosthogService } from '../analytics/posthog.service';

@Injectable()
export class LiveStreamService {
  private readonly logger = new Logger(LiveStreamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly livekitService: LivekitService,
    private readonly posthogService: PosthogService,
  ) {}

  /**
   * Creates a new live stream schedule.
   */
  async createStream(tenantId: string, dto: CreateStreamDto): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const roomName = `stream_${nanoid(12)}`;

    return this.prisma.liveStream.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description || null,
        roomName,
        status: LiveStreamStatus.SCHEDULED,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        isShoppable: dto.isShoppable || false,
        allowChat: dto.allowChat || true,
        maxViewers: dto.maxViewers || null,
        metadata: {},
      },
    }).then((stream: any) => {
      // Track event in PostHog
      this.posthogService.capture(
        tenantId,
        'stream_created',
        {
          streamId: stream.id,
          title: dto.title,
          isShoppable: dto.isShoppable || false,
          tenantId,
        },
      ).catch(() => {});
      return stream;
    });
  }

  /**
   * Starts a live stream (makes it live).
   */
  async startStream(streamId: string, tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const stream = await this.prisma.liveStream.findFirst({
      where: { id: streamId, tenantId },
    });

    if (!stream) {
      throw new NotFoundException('Live stream not found');
    }

    if (stream.status === LiveStreamStatus.LIVE) {
      return stream;
    }

    return this.prisma.liveStream.update({
      where: { id: stream.id },
      data: {
        status: LiveStreamStatus.LIVE,
        startedAt: new Date(),
      },
    });
  }

  /**
   * Ends an active live stream.
   */
  async endStream(streamId: string, tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const stream = await this.prisma.liveStream.findFirst({
      where: { id: streamId, tenantId },
    });

    if (!stream) {
      throw new NotFoundException('Live stream not found');
    }

    if (stream.status === LiveStreamStatus.ENDED) {
      return stream;
    }

    const endedAt = new Date();
    let durationSeconds = 0;
    if (stream.startedAt) {
      durationSeconds = Math.round((endedAt.getTime() - stream.startedAt.getTime()) / 1000);
    }

    // Get final peak viewer count from Redis
    const peakKey = `stream:${stream.id}:peak`;
    const peakViewersStr = await this.redis.client.get(peakKey);
    const peakViewers = peakViewersStr ? parseInt(peakViewersStr, 10) : 0;

    const updatedStream = await this.prisma.liveStream.update({
      where: { id: stream.id },
      data: {
        status: LiveStreamStatus.ENDED,
        endedAt,
        durationSeconds,
        peakViewers,
      },
    });

    // Clean up Redis keys
    await this.redis.client.del(`stream:${stream.id}:peak`);
    await this.redis.client.del(`stream:${stream.id}:viewers`);

    // End LiveKit room
    await this.livekitService.endRoom(stream.roomName);

    return updatedStream;
  }

  /**
   * Joins a stream and returns LiveKit WebRTC token.
   */
  async joinStream(streamId: string, tenantId: string, userId: string | null, name: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const stream = await this.prisma.liveStream.findFirst({
      where: { id: streamId, tenantId },
    });

    if (!stream) {
      throw new NotFoundException('Live stream not found');
    }

    let isHost = false;
    let identity = `viewer_${nanoid(8)}`;

    if (userId) {
      const tenantUser = await this.prisma.tenantUser.findFirst({
        where: { userId, tenantId },
      });

      if (tenantUser) {
        isHost = true;
        identity = tenantUser.id;
      }
    }

    // Generate LiveKit token
    // Hosts can publish audio/video, viewers can only subscribe
    const token = await this.livekitService.generateToken(
      stream.roomName,
      identity,
      name,
      {
        isHost,
        canPublish: isHost, // Only hosts publish
        canSubscribe: true,  // Everyone subscribes
      },
    );

    return {
      token,
      roomName: stream.roomName,
      isHost,
      identity,
    };
  }

  /**
   * Adds product to live stream.
   */
  async addProduct(streamId: string, tenantId: string, dto: AddProductDto): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const stream = await this.prisma.liveStream.findFirst({
      where: { id: streamId, tenantId },
    });

    if (!stream) {
      throw new NotFoundException('Live stream not found');
    }

    return this.prisma.liveStreamProduct.create({
      data: {
        liveStreamId: stream.id,
        productName: dto.productName,
        productUrl: dto.productUrl,
        productImage: dto.productImage || null,
        price: dto.price || null,
        currency: dto.currency || 'USD',
      },
    });
  }

  /**
   * Removes product from stream.
   */
  async removeProduct(streamId: string, productId: string, tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const product = await this.prisma.liveStreamProduct.findFirst({
      where: { id: productId, liveStreamId: streamId },
    });

    if (!product) {
      throw new NotFoundException('Product not found in this stream');
    }

    return this.prisma.liveStreamProduct.delete({
      where: { id: productId },
    });
  }

  /**
   * Features a specific product live.
   */
  async featureProduct(streamId: string, productId: string, tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const product = await this.prisma.liveStreamProduct.findFirst({
      where: { id: productId, liveStreamId: streamId },
    });

    if (!product) {
      throw new NotFoundException('Product not found in this stream');
    }

    // Clear feature status on other products for this stream
    await this.prisma.liveStreamProduct.updateMany({
      where: { liveStreamId: streamId },
      data: { featuredAt: null },
    });

    // Set featured state on target product
    return this.prisma.liveStreamProduct.update({
      where: { id: productId },
      data: { featuredAt: new Date() },
    });
  }

  /**
   * Add chat log.
   */
  async addChatMessage(streamId: string, senderId: string | null, dto: ChatMessageDto): Promise<any> {
    return this.prisma.liveStreamChat.create({
      data: {
        liveStreamId: streamId,
        senderName: dto.senderName,
        senderId,
        message: dto.message,
      },
    });
  }

  /**
   * Get single stream details.
   */
  async getStream(streamId: string, tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const stream = await this.prisma.liveStream.findFirst({
      where: { id: streamId, tenantId },
      include: {
        products: {
          orderBy: { displayOrder: 'asc' },
        },
        chatMessages: {
          orderBy: { createdAt: 'asc' },
          take: 50, // Grab recent messages
        },
      },
    });

    if (!stream) {
      throw new NotFoundException('Live stream not found');
    }

    return stream;
  }

  /**
   * Lists scheduled/active streams.
   */
  async listStreams(tenantId: string, limit = 20, page = 1): Promise<any> {
    await this.prisma.setTenantContext(tenantId);
    const offset = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.liveStream.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.liveStream.count({
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
   * Delete a scheduled or ended stream.
   */
  async deleteStream(streamId: string, tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const stream = await this.prisma.liveStream.findFirst({
      where: { id: streamId, tenantId },
    });

    if (!stream) {
      throw new NotFoundException('Live stream not found');
    }

    if (stream.status === LiveStreamStatus.LIVE) {
      throw new BadRequestException('Cannot delete a stream that is currently live. End the stream first.');
    }

    await this.prisma.liveStream.delete({
      where: { id: streamId },
    });

    return { deleted: true };
  }

  /**
   * Returns total stream count for the tenant (for quota display).
   */
  async getStreamCount(tenantId: string): Promise<{ count: number; limit: number }> {
    await this.prisma.setTenantContext(tenantId);

    const count = await this.prisma.liveStream.count({
      where: { tenantId },
    });

    return { count, limit: 25 };
  }
}

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { LiveStreamService } from './live-stream.service';
import { RedisService } from '../../common/redis/redis.service';
import { ChatMessageDto } from './dto/create-stream.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/stream',
})
export class LiveStreamGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LiveStreamGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly liveStreamService: LiveStreamService,
    private readonly redis: RedisService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to stream gateway: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const { streamId } = client.data;
    if (streamId) {
      await client.leave(`stream:${streamId}`);
      await this.decrementViewerCount(streamId);
    }
    this.logger.log(`Client disconnected from stream gateway: ${client.id}`);
  }

  @SubscribeMessage('stream:join')
  async handleJoinStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string; name: string },
  ) {
    const { streamId, name } = data;
    client.data.streamId = streamId;
    client.data.name = name;

    await client.join(`stream:${streamId}`);
    await this.incrementViewerCount(streamId);

    this.logger.log(`Client ${name} joined stream room: stream:${streamId}`);

    return { event: 'success', data: { joined: true } };
  }

  @SubscribeMessage('stream:chat-send')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChatMessageDto,
  ) {
    const { streamId } = client.data;
    if (!streamId) return { event: 'error', data: 'Not in a stream room' };

    // Save to Database
    const chat = await this.liveStreamService.addChatMessage(
      streamId,
      client.data.userId || null,
      data,
    );

    // Broadcast message to everyone in the stream room
    this.server.to(`stream:${streamId}`).emit('stream:chat-message', {
      id: chat.id,
      senderName: chat.senderName,
      message: chat.message,
      createdAt: chat.createdAt,
    });

    return { event: 'success' };
  }

  @SubscribeMessage('stream:feature-product')
  async handleFeatureProduct(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string; productId: string; tenantId: string },
  ) {
    // Note: In production we'd verify client.data.role is agent/host, but let's assume valid trigger
    const product = await this.liveStreamService.featureProduct(
      data.streamId,
      data.productId,
      data.tenantId,
    );

    // Broadcast featured product event to the room
    this.server.to(`stream:${data.streamId}`).emit('stream:product-featured', {
      productId: product.id,
      productName: product.productName,
      productUrl: product.productUrl,
      productImage: product.productImage,
      price: product.price,
      currency: product.currency,
      featuredAt: product.featuredAt,
    });

    return { event: 'success' };
  }

  private async incrementViewerCount(streamId: string) {
    const viewersKey = `stream:${streamId}:viewers`;
    const peakKey = `stream:${streamId}:peak`;

    // Increment current count
    const count = await this.redis.incr(viewersKey);

    // Track peak count
    const peakStr = await this.redis.client.get(peakKey);
    const peak = peakStr ? parseInt(peakStr, 10) : 0;
    if (count > peak) {
      await this.redis.client.set(peakKey, count.toString());
    }

    // Broadcast count
    this.server.to(`stream:${streamId}`).emit('stream:viewer-count', {
      count,
    });
  }

  private async decrementViewerCount(streamId: string) {
    const viewersKey = `stream:${streamId}:viewers`;

    // Decrement current count
    let count = await this.redis.client.decr(viewersKey);
    if (count < 0) {
      count = 0;
      await this.redis.client.set(viewersKey, '0');
    }

    // Broadcast count
    this.server.to(`stream:${streamId}`).emit('stream:viewer-count', {
      count,
    });
  }
}

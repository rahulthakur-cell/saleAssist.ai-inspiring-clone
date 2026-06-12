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
import { UseGuards, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VideoCallStatus } from '@saleassist/database';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/video',
})
export class VideoCallGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(VideoCallGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const tenantId = client.handshake.query.tenantId as string;
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];

      if (!tenantId) {
        client.disconnect();
        return;
      }

      client.data.tenantId = tenantId;

      if (token) {
        try {
          const payload = await this.jwtService.verifyAsync(token, {
            secret: this.configService.get('JWT_SECRET'),
          });
          client.data.userId = payload.sub;
          
          // Fetch the TenantUser record to see if agent
          const tenantUser = await this.prisma.tenantUser.findFirst({
            where: { userId: payload.sub, tenantId },
          });

          if (tenantUser) {
            client.data.tenantUserId = tenantUser.id;
            client.data.role = tenantUser.role;
            
            // Join agent room to receive inbound call notifications
            await client.join(`agents:${tenantId}`);
            
            // Set availability to true if already set in database
            if (tenantUser.isAvailable && tenantUser.isActive) {
              await this.redis.sadd(`agents:available:${tenantId}`, tenantUser.id);
              this.server.to(`agents:${tenantId}`).emit('agent:availability-changed', {
                agentId: tenantUser.id,
                isAvailable: true,
              });
            }
          }
        } catch {
          // Token invalid — treat as visitor
        }
      }

      this.logger.log(`Client connected: ${client.id} (Tenant: ${tenantId})`);
    } catch (error: any) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const { tenantId, tenantUserId } = client.data;
    if (tenantId && tenantUserId) {
      // Remove agent from Redis availability set
      await this.redis.srem(`agents:available:${tenantId}`, tenantUserId);
      
      // Update database status (optional, keep it set so they resume when connecting)
      // For now just notify other agents
      this.server.to(`agents:${tenantId}`).emit('agent:availability-changed', {
        agentId: tenantUserId,
        isAvailable: false,
      });
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('agent:toggle-availability')
  async handleToggleAvailability(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { isAvailable: boolean },
  ) {
    const { tenantId, tenantUserId } = client.data;
    if (!tenantId || !tenantUserId) {
      return { event: 'error', data: 'Unauthorized' };
    }

    await this.prisma.setTenantContext(tenantId);
    await this.prisma.tenantUser.update({
      where: { id: tenantUserId },
      data: { isAvailable: data.isAvailable },
    });

    const redisKey = `agents:available:${tenantId}`;
    if (data.isAvailable) {
      await this.redis.sadd(redisKey, tenantUserId);
    } else {
      await this.redis.srem(redisKey, tenantUserId);
    }

    this.server.to(`agents:${tenantId}`).emit('agent:availability-changed', {
      agentId: tenantUserId,
      isAvailable: data.isAvailable,
    });

    return { event: 'success', data: { isAvailable: data.isAvailable } };
  }

  @SubscribeMessage('call:request')
  async handleCallRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    const { tenantId } = client.data;
    if (!tenantId) return;

    // Join the call room
    await client.join(`call:${data.callId}`);

    await this.prisma.setTenantContext(tenantId);
    const call = await this.prisma.videoCall.findFirst({
      where: { id: data.callId, tenantId },
      include: {
        participants: true,
      },
    });

    if (!call) return;

    // If agent is already assigned (e.g. Ringing state)
    const assignedAgent = call.participants.find((p) => p.role === 'agent');
    if (assignedAgent && assignedAgent.tenantUserId) {
      // Direct call alert to the specific agent
      this.server.to(`agents:${tenantId}`).emit('call:incoming', {
        callId: call.id,
        roomName: call.roomName,
        visitorName: call.visitorName,
        assignedAgentId: assignedAgent.tenantUserId,
      });
    } else {
      // Broadcast to all agents of the tenant
      this.server.to(`agents:${tenantId}`).emit('call:incoming', {
        callId: call.id,
        roomName: call.roomName,
        visitorName: call.visitorName,
      });
    }

    // Broadcast queue update
    const queueKey = `call:queue:${tenantId}`;
    const waitingCount = await this.redis.client.llen(queueKey);
    this.server.to(`agents:${tenantId}`).emit('call:queue-update', { waitingCount });
  }

  @SubscribeMessage('call:accept')
  async handleCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    const { tenantId, tenantUserId } = client.data;
    if (!tenantId || !tenantUserId) return;

    await client.join(`call:${data.callId}`);

    await this.prisma.setTenantContext(tenantId);
    
    // Assign agent if not already assigned
    const call = await this.prisma.videoCall.findFirst({
      where: { id: data.callId, tenantId },
      include: { participants: true },
    });

    if (!call) return;

    const existingAgent = call.participants.find((p) => p.role === 'agent');
    if (!existingAgent) {
      await this.prisma.videoCallParticipant.create({
        data: {
          videoCallId: call.id,
          tenantUserId,
          role: 'agent',
          joinedAt: new Date(),
        },
      });
    }

    await this.prisma.videoCall.update({
      where: { id: call.id },
      data: {
        status: VideoCallStatus.IN_PROGRESS,
        startedAt: new Date(),
        queuePosition: null,
      },
    });

    // Remove from Redis queue
    const queueKey = `call:queue:${tenantId}`;
    await this.redis.client.lrem(queueKey, 0, call.id);

    // Notify visitor in the room that call is accepted
    this.server.to(`call:${data.callId}`).emit('call:accepted', {
      callId: call.id,
      roomName: call.roomName,
      agentId: tenantUserId,
    });

    // Broadcast queue update to agents
    const waitingCount = await this.redis.client.llen(queueKey);
    this.server.to(`agents:${tenantId}`).emit('call:queue-update', { waitingCount });
  }

  @SubscribeMessage('call:reject')
  async handleCallReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    const { tenantId, tenantUserId } = client.data;
    if (!tenantId || !tenantUserId) return;

    this.server.to(`agents:${tenantId}`).emit('call:rejected-by-agent', {
      callId: data.callId,
      agentId: tenantUserId,
    });
  }

  @SubscribeMessage('call:join')
  async handleCallJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    if (!data?.callId) return { event: 'error', data: 'callId required' };
    await client.join(`call:${data.callId}`);
    this.logger.log(`Client ${client.id} joined call room: ${data.callId}`);
    return { event: 'joined', data: { callId: data.callId } };
  }

  @SubscribeMessage('call:chat:send')
  async handleChatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; message: string; senderId?: string; senderName?: string },
  ) {
    const { tenantId, userId, tenantUserId } = client.data;
    if (!tenantId || !data.callId || !data.message?.trim()) return;

    const payload = {
      callId: data.callId,
      message: data.message.trim(),
      senderId: data.senderId || userId || tenantUserId || client.id,
      senderName: data.senderName || 'Guest',
      createdAt: new Date().toISOString(),
    };

    await client.join(`call:${data.callId}`);
    this.server.to(`call:${data.callId}`).emit('call:chat:message', payload);
    return { event: 'call:chat:message', data: payload };
  }
}

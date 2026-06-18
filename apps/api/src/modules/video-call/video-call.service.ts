import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { LivekitService } from './livekit.service';
import { CreateCallDto } from './dto/create-call.dto';
import { VideoCallStatus, VideoCallType, LeadSource, LeadStatus, Prisma } from '@saleassist/database';
import { nanoid } from 'nanoid';
import { PosthogService } from '../analytics/posthog.service';
import { StorageService } from '../storage/storage.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class VideoCallService {
  private readonly logger = new Logger(VideoCallService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'recordings');

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly livekitService: LivekitService,
    private readonly posthogService: PosthogService,
    private readonly configService: ConfigService,
    private readonly storage: StorageService,
  ) {
    if (!fs.existsSync(this.uploadDir)) fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async getChatHistory(callId: string, tenantId: string) {
    await this.prisma.setTenantContext(tenantId);
    const messages = await this.prisma.videoCallChatMessage.findMany({
      where: { videoCallId: callId },
      orderBy: { createdAt: 'asc' },
    });
    return messages;
  }

  async sendChatMessage(callId: string, tenantId: string, data: { message: string; senderName: string; senderId?: string; attachmentUrl?: string; attachmentType?: string; attachmentName?: string }) {
    await this.prisma.setTenantContext(tenantId);
    this.logger.debug(`sendChatMessage start callId=${callId} tenantId=${tenantId} payload=${JSON.stringify({ message: data.message, senderName: data.senderName, senderId: data.senderId })}`);
    let message;
    try {
      message = await this.prisma.videoCallChatMessage.create({
        data: {
          videoCallId: callId,
          senderId: data.senderId,
          senderName: data.senderName,
          message: data.message,
          attachmentUrl: data.attachmentUrl,
          attachmentType: data.attachmentType,
          attachmentName: data.attachmentName,
        },
      });
    } catch (err) {
      this.logger.error(`sendChatMessage prisma error callId=${callId} err=${err instanceof Error ? err.message : JSON.stringify(err)}`);
      throw err;
    }
    this.logger.debug(`sendChatMessage success callId=${callId} id=${message.id}`);
    return message;
  }

  async getChatAttachmentUploadUrl(callId: string, tenantId: string, data: { fileName: string; fileType: string }) {
    await this.prisma.setTenantContext(tenantId);
    const call = await this.prisma.videoCall.findFirst({ where: { id: callId, tenantId } });
    if (!call) throw new NotFoundException('Video call not found');

    const ext = data.fileName.split('.').pop() || '';
    const objectName = `chat-attachments/${callId}-${nanoid(8)}.${ext}`;
    const minioEndpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost');
    const minioPort = this.configService.get<string>('MINIO_PORT', '9000');
    const minioUseSSL = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const protocol = minioUseSSL ? 'https' : 'http';
    const publicUrl = `${protocol}://${minioEndpoint}:${minioPort}/saleassist/${objectName}`;
    const presignedUrl = await this.storage.getPresignedUploadUrl(objectName);

    return { presignedUrl, publicUrl, objectName };
  }

  async attachRecording(callId: string, tenantId: string, data: { sizeBytes?: number; durationSec?: number; mimeType?: string }) {
    await this.prisma.setTenantContext(tenantId);
    const call = await this.prisma.videoCall.findFirst({ where: { id: callId, tenantId } });
    if (!call) throw new NotFoundException('Video call not found');

    try {
      // Generate a unique object name for the recording
      const objectName = `recordings/${callId}-${Date.now()}.${data.mimeType?.includes('webm') ? 'webm' : 'mp4'}`;
      
      // Get public URL for the recording
      const minioEndpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost');
      const minioPort = this.configService.get<string>('MINIO_PORT', '9000');
      const minioUseSSL = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
      const protocol = minioUseSSL ? 'https' : 'http';
      const publicUrl = `${protocol}://${minioEndpoint}:${minioPort}/saleassist/${objectName}`;

      const recording = await this.prisma.videoCallRecording.create({
        data: {
          videoCallId: callId,
          url: publicUrl,
          sizeBytes: data.sizeBytes,
          durationSec: data.durationSec,
          mimeType: data.mimeType,
        },
      });

      await this.prisma.videoCall.update({
        where: { id: callId },
        data: { recordingUrl: publicUrl },
      });

      // Return presigned URL for frontend to upload directly
      const presignedUrl = await this.storage.getPresignedUploadUrl(objectName);
      return { ...recording, presignedUrl, objectName };
    } catch (err: any) {
      this.logger.error(`Failed to prepare recording upload: ${err.message}`);
      throw err;
    }
  }

  async startRoomRecording(callId: string, tenantId: string): Promise<{ recordingId: string; fallbackToScreen?: boolean }> {
    try {
      await this.prisma.setTenantContext(tenantId);
      const call = await this.prisma.videoCall.findFirst({ where: { id: callId, tenantId } });
      if (!call) throw new NotFoundException('Video call not found');
      if (!call.roomName) throw new NotFoundException('Room name not found for this call');

      const result = await this.livekitService.startRoomRecording(call.roomName);
      
      if (!result.success) {
        this.logger.warn(`Room recording unavailable, falling back: ${result.error}`);
        return { recordingId: '', fallbackToScreen: true };
      }
      
      const existingMetadata: Prisma.JsonObject =
        call.metadata && typeof call.metadata === 'object' && !Array.isArray(call.metadata)
          ? (call.metadata as Prisma.JsonObject)
          : {};
      
      const metadata: Prisma.InputJsonObject = {
        ...existingMetadata,
        egressId: result.egressId,
        recordingStatus: 'in_progress',
      };

      await this.prisma.videoCall.update({
        where: { id: callId },
        data: { metadata },
      });

      const recording = await this.prisma.videoCallRecording.create({
        data: {
          videoCallId: callId,
          url: `recording:${result.egressId}`,
        },
      });

      return { recordingId: recording.id };
    } catch (err: any) {
      this.logger.error(`startRoomRecording failed: ${err.message}`);
      // Return fallback without throwing to prevent 500 error
      return { recordingId: '', fallbackToScreen: true };
    }
  }

  async stopRoomRecording(callId: string, tenantId: string, recordingId?: string): Promise<void> {
    try {
      await this.prisma.setTenantContext(tenantId);
      const call = await this.prisma.videoCall.findFirst({ where: { id: callId, tenantId } });
      if (!call) return; // Silently return if call not found

      const existingMetadata: Prisma.JsonObject =
        call.metadata && typeof call.metadata === 'object' && !Array.isArray(call.metadata)
          ? (call.metadata as Prisma.JsonObject)
          : {};
      
      const egressId = existingMetadata.egressId as string | undefined;
      
      const metadata: Prisma.InputJsonObject = {
        ...existingMetadata,
        recordingStatus: 'stopped',
      };

      if (egressId) {
        await this.livekitService.stopRoomRecording(egressId);
      }
      
      await this.prisma.videoCall.update({
        where: { id: callId },
        data: { metadata },
      });
    } catch (err: any) {
      this.logger.error(`stopRoomRecording failed: ${err.message}`);
      throw err;
    }
  }

  getLiveKitConfig(): { liveKitUrl: string } {
    const liveKitUrl = this.configService.get<string>('LIVEKIT_URL', 'http://localhost:7880');
    return { liveKitUrl };
  }

  /**
   * Initiates a new video call request.
   */
  async createCall(tenantId: string, dto: CreateCallDto, visitorId?: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const roomName = `call_${nanoid(12)}`;

    // Create call record in Database
    const videoCall = await this.prisma.videoCall.create({
      data: {
        tenantId,
        roomName,
        type: dto.type || VideoCallType.INBOUND,
        status: VideoCallStatus.WAITING,
        visitorId: visitorId || null,
        visitorName: dto.visitorName || 'Guest Visitor',
        visitorEmail: dto.visitorEmail || null,
        visitorPhone: dto.visitorPhone || null,
        routingMethod: dto.routingMethod || 'round-robin',
        metadata: {},
      },
    });

    // Handle routing logic for inbound calls
    if (videoCall.type === VideoCallType.INBOUND) {
      const availableAgents = await this.getAvailableAgents(tenantId);

      if (availableAgents.length > 0) {
        // Select the first available agent (simple routing)
        const agentTenantUserId = availableAgents[0];
        
        // Update call with assigned agent (via participant creation)
        await this.prisma.videoCallParticipant.create({
          data: {
            videoCallId: videoCall.id,
            tenantUserId: agentTenantUserId,
            role: 'agent',
          },
        });

        // Update status to RINGING
        await this.prisma.videoCall.update({
          where: { id: videoCall.id },
          data: { status: VideoCallStatus.RINGING },
        });

        videoCall.status = VideoCallStatus.RINGING;
      } else {
        // No agents available, put in waiting queue
        const queueKey = `call:queue:${tenantId}`;
        await this.redis.client.rpush(queueKey, videoCall.id);
        const queuePos = await this.redis.client.llen(queueKey);

        await this.prisma.videoCall.update({
          where: { id: videoCall.id },
          data: { queuePosition: queuePos },
        });

        videoCall.queuePosition = queuePos;
      }
    }

    if (videoCall.type === VideoCallType.OUTBOUND && videoCall.visitorEmail) {
      const inviteUrl = this.buildCallInviteUrl(videoCall.id, tenantId);
      const inviteEmail = await this.sendOutboundCallInvite({
        to: videoCall.visitorEmail,
        visitorName: videoCall.visitorName || 'Customer',
        inviteUrl,
      });

      return {
        ...videoCall,
        inviteUrl,
        inviteEmailSent: inviteEmail.sent,
        inviteEmailError: inviteEmail.error,
      };
    }

    return videoCall;
  }

  /**
   * Generates token to join call.
   */
  async joinCall(callId: string, tenantId: string, userId: string | null, participantName: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const call = await this.prisma.videoCall.findFirst({
      where: { id: callId, tenantId },
      include: { participants: true },
    });

    if (!call) {
      throw new NotFoundException('Video call not found');
    }

    // Determine user role and permissions
    let role = 'visitor';
    let isHost = false;
    let participantId = userId || `visitor_${nanoid(8)}`;

    if (userId) {
      // Find TenantUser matching the userId
      const tenantUser = await this.prisma.tenantUser.findFirst({
        where: { userId, tenantId },
      });

      if (tenantUser) {
        role = 'agent';
        isHost = true;
        participantId = tenantUser.id;

        // Record participant join status
        const existingParticipant = call.participants.find(
          (p) => p.tenantUserId === tenantUser.id,
        );

        if (!existingParticipant) {
          await this.prisma.videoCallParticipant.create({
            data: {
              videoCallId: call.id,
              tenantUserId: tenantUser.id,
              role: 'agent',
              joinedAt: new Date(),
            },
          });
        } else {
          await this.prisma.videoCallParticipant.update({
            where: { id: existingParticipant.id },
            data: { joinedAt: new Date() },
          });
        }
      }
    } else {
      // Record visitor participant join status
      const existingVisitorParticipant = call.participants.find(
        (p) => p.role === 'visitor',
      );
      if (!existingVisitorParticipant) {
        await this.prisma.videoCallParticipant.create({
          data: {
            videoCallId: call.id,
            role: 'visitor',
            joinedAt: new Date(),
          },
        });
      }
    }

    // If call is starting (first participant joins)
    if (call.status === VideoCallStatus.WAITING || call.status === VideoCallStatus.RINGING) {
      await this.prisma.videoCall.update({
        where: { id: call.id },
        data: {
          status: VideoCallStatus.IN_PROGRESS,
          startedAt: new Date(),
          queuePosition: null, // Clear queue position
        },
      });

      // Remove from Redis queue if it was queued
      const queueKey = `call:queue:${tenantId}`;
      await this.redis.client.lrem(queueKey, 0, call.id);
    }

    // Generate LiveKit token
    const token = await this.livekitService.generateToken(
      call.roomName,
      participantId,
      participantName,
      {
        isHost,
        canPublish: true,
        canSubscribe: true,
      },
    );

    // Track event in PostHog
    this.posthogService.capture(
      participantId,
      'video_call_joined',
      {
        callId: call.id,
        roomName: call.roomName,
        role,
        tenantId,
      },
    ).catch(() => {});

    return {
      token,
      roomName: call.roomName,
      callId: call.id,
      status: VideoCallStatus.IN_PROGRESS,
    };
  }

  /**
   * Ends a video call.
   */
  async endCall(callId: string, tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const call = await this.prisma.videoCall.findFirst({
      where: { id: callId, tenantId },
    });

    if (!call) {
      throw new NotFoundException('Video call not found');
    }

    if (call.status === VideoCallStatus.COMPLETED || call.status === VideoCallStatus.CANCELLED) {
      return call;
    }

    const endedAt = new Date();
    let durationSeconds = 0;
    if (call.startedAt) {
      durationSeconds = Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000);
    }

    // Update database record
    const updatedCall = await this.prisma.videoCall.update({
      where: { id: call.id },
      data: {
        status: VideoCallStatus.COMPLETED,
        endedAt,
        durationSeconds,
      },
    });

    // Remove from Redis queue
    const queueKey = `call:queue:${tenantId}`;
    await this.redis.client.lrem(queueKey, 0, call.id);

    // End LiveKit room
    await this.livekitService.endRoom(call.roomName);

    // Create a Lead automatically from Inbound Calls
    if (call.type === VideoCallType.INBOUND && (call.visitorEmail || call.visitorName || call.visitorPhone)) {
      try {
        await this.prisma.lead.create({
          data: {
            tenantId,
            videoCallId: call.id,
            name: call.visitorName,
            email: call.visitorEmail,
            phone: call.visitorPhone,
            source: LeadSource.VIDEO_CALL,
            status: LeadStatus.NEW,
            message: `Lead captured from video call. Duration: ${durationSeconds}s.`,
          },
        });
      } catch (err: any) {
        this.logger.error(`Failed to auto-create lead: ${err.message}`);
      }
    }

    return updatedCall;
  }

  /**
   * Retrieves call details.
   */
  async getCall(callId: string, tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);
    const call = await this.prisma.videoCall.findFirst({
      where: { id: callId, tenantId },
      include: {
        participants: {
          include: {
            tenantUser: {
              include: {
                user: {
                  select: { name: true, email: true, avatar: true },
                },
              },
            },
          },
        },
        visitor: true,
      },
    });

    if (!call) {
      throw new NotFoundException('Video call not found');
    }

    return call;
  }

  async updateCall(
    callId: string,
    tenantId: string,
    data: {
      visitorName?: string;
      visitorEmail?: string;
      visitorPhone?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<any> {
    await this.prisma.setTenantContext(tenantId);

    const call = await this.prisma.videoCall.findFirst({
      where: { id: callId, tenantId },
    });

    if (!call) {
      throw new NotFoundException('Video call not found');
    }

    const existingMetadata: Prisma.JsonObject =
      call.metadata && typeof call.metadata === 'object' && !Array.isArray(call.metadata)
        ? (call.metadata as Prisma.JsonObject)
        : {};
    const metadata: Prisma.InputJsonObject | undefined = data.metadata
      ? { ...existingMetadata, ...(data.metadata as Prisma.InputJsonObject) }
      : undefined;

    return this.prisma.videoCall.update({
      where: { id: call.id },
      data: {
        visitorName: data.visitorName ?? call.visitorName,
        visitorEmail: data.visitorEmail ?? call.visitorEmail,
        visitorPhone: data.visitorPhone ?? call.visitorPhone,
        ...(metadata ? { metadata } : {}),
      },
    });
  }

  /**
   * Lists past video calls.
   */
  async listCalls(tenantId: string, limit = 20, page = 1): Promise<any> {
    await this.prisma.setTenantContext(tenantId);
    const offset = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.videoCall.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          participants: {
            include: {
              tenantUser: {
                include: {
                  user: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.videoCall.count({
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
   * Gets list of available agents from Redis.
   */
  async getAvailableAgents(tenantId: string): Promise<string[]> {
    const key = `agents:available:${tenantId}`;
    return this.redis.smembers(key);
  }

  /**
   * Gets queue status.
   */
  async getQueueStatus(tenantId: string): Promise<any> {
    const queueKey = `call:queue:${tenantId}`;
    const length = await this.redis.client.llen(queueKey);
    return {
      waitingCount: length,
    };
  }

  private buildCallInviteUrl(callId: string, tenantId: string): string {
    const appUrl =
      this.configService.get<string>('PUBLIC_APP_URL') ||
      this.configService.get<string>('APP_URL', 'http://localhost:3000');
    return `${appUrl.replace(/\/$/, '')}/join-call/${callId}?tenantId=${tenantId}`;
  }

  private async sendOutboundCallInvite(data: {
    to: string;
    visitorName: string;
    inviteUrl: string;
  }): Promise<{ sent: boolean; error?: string }> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const from = this.configService.get<string>('EMAIL_FROM', 'noreply@yourdomain.com');

    if (!apiKey) {
      const error = 'RESEND_API_KEY is not configured';
      this.logger.warn(`Skipping outbound call invite email to ${data.to}: ${error}`);
      return { sent: false, error };
    }

    try {
      const response: any = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: data.to,
          subject: 'Your SaleAssist video call is ready',
          html: [
            `<p>Hi ${data.visitorName},</p>`,
            '<p>Your video call room is ready. Click the button below to join.</p>',
            `<p><a href="${data.inviteUrl}" style="display:inline-block;padding:12px 18px;background:#6d5dfc;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Join video call</a></p>`,
            `<p>If the button does not work, open this link:<br><a href="${data.inviteUrl}">${data.inviteUrl}</a></p>`,
          ].join(''),
          text: `Hi ${data.visitorName},\n\nYour video call room is ready. Join here:\n${data.inviteUrl}`,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const error = `${response.status} ${errorBody}`;
        this.logger.warn(`Failed to send outbound call invite to ${data.to}: ${error}`);
        return { sent: false, error };
      }

      return { sent: true };
    } catch (error: any) {
      this.logger.warn(`Failed to send outbound call invite to ${data.to}: ${error.message}`);
      return { sent: false, error: error.message };
    }
  }
}

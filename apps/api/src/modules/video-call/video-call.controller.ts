import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { VideoCallService } from './video-call.service';
import { VideoCallGateway } from './video-call.gateway';
import { CreateCallDto, JoinCallDto } from './dto/create-call.dto';
import { JwtAuthGuard, RbacGuard } from '../../common/guards';
import { CurrentUser, Public, TenantId, RequirePermissions } from '../../common/decorators';

@ApiTags('Video Calls')
@Controller('video-calls')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class VideoCallController {
  constructor(
    private readonly videoCallService: VideoCallService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly videoCallGateway: VideoCallGateway,
  ) {}

  @Post()
  @Public() // Allow anonymous visitors or widget API keys to initiate calls
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate a new video call (visitor or outbound)' })
  async createCall(
    @TenantId() tenantId: string,
    @Body() dto: CreateCallDto,
    @Req() req: any,
  ): Promise<any> {
    // If visitor is logged in, extract visitorId from req (if available)
    const visitorId = req.visitorId || undefined;
    return this.videoCallService.createCall(tenantId, dto, visitorId);
  }

  @Post(':id/join')
  @Public() // Allow anonymous visitors to join call room
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a call and retrieve LiveKit access token' })
  async joinCall(
    @Param('id') callId: string,
    @TenantId() tenantId: string,
    @Body() dto: JoinCallDto,
    @Req() req: any,
  ): Promise<any> {
    let userId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = await this.jwtService.verifyAsync(token, {
          secret: this.configService.get('JWT_SECRET'),
        });
        userId = payload.sub || null;
      } catch {
        // Ignore parsing errors, treat as visitor
      }
    }

    // Double check if req.user is set (populated by tenant middleware/guards)
    if (req.user && req.user.sub) {
      userId = req.user.sub;
    }

    return this.videoCallService.joinCall(callId, tenantId, userId, dto.participantName);
  }

  @Post(':id/end')
  @RequirePermissions('video_call:join') // Only authenticated agents can end calls
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End an active video call' })
  async endCall(@Param('id') callId: string, @TenantId() tenantId: string): Promise<any> {
    return this.videoCallService.endCall(callId, tenantId);
  }

  @Get('queue')
  @RequirePermissions('video_call:view')
  @ApiOperation({ summary: 'Get call queue length' })
  async getQueueStatus(@TenantId() tenantId: string): Promise<any> {
    return this.videoCallService.getQueueStatus(tenantId);
  }

  @Get('livekit-config')
  @Public()
  @ApiOperation({ summary: 'Get LiveKit server URL for the frontend' })
  async getLiveKitConfig(): Promise<{ liveKitUrl: string }> {
    return this.videoCallService.getLiveKitConfig();
  }

  @Get(':id/chat')
  @Public()
  @ApiOperation({ summary: 'Get video call chat history' })
  async getChat(@Param('id') callId: string, @TenantId() tenantId?: string): Promise<any> {
    return this.videoCallService.getChatHistory(callId, tenantId);
  }

  @Post(':id/chat')
  @Public()
  @ApiOperation({ summary: 'Send a video call chat message' })
  async sendChat(
    @Param('id') callId: string,
    @Body() dto: { message: string; senderName: string; senderId?: string; attachmentUrl?: string; attachmentType?: string; attachmentName?: string },
    @TenantId() tenantId?: string,
  ): Promise<any> {
    console.log('[sendChat] hit', { callId, tenantId, dto });
    try {
      const result = await this.videoCallService.sendChatMessage(callId, dto, tenantId);
      const ioServer = VideoCallGateway.serverInstance || this.videoCallGateway?.server;
      if (ioServer) {
        ioServer.to(`call:${callId}`).emit('call:chat:message', {
          id: result.id,
          callId: result.videoCallId,
          message: result.message,
          senderId: result.senderId || dto.senderId,
          senderName: result.senderName,
          createdAt: result.createdAt.toISOString(),
          attachmentUrl: result.attachmentUrl,
          attachmentType: result.attachmentType,
          attachmentName: result.attachmentName,
        });
      } else {
        console.warn('[sendChat] WebSocket server not initialized yet');
      }
      return result;
    } catch (err) {
      console.log('[sendChat] error', err instanceof Error ? err.message : err);
      throw err;
    }
  }

  @Post(':id/chat/upload')
  @Public()
  @ApiOperation({ summary: 'Get presigned URL for uploading chat attachment' })
  async getChatUploadUrl(
    @Param('id') callId: string,
    @TenantId() tenantId: string,
    @Query('tenantId') queryTenantId: string,
    @Body() dto: { fileName: string; fileType: string },
  ): Promise<any> {
    const effectiveTenantId = tenantId || queryTenantId;
    if (!effectiveTenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.videoCallService.getChatAttachmentUploadUrl(callId, effectiveTenantId, dto);
  }

  @Post(':id/recordings/upload')
  @Public()
  @ApiOperation({ summary: 'Get presigned URL for uploading a video call recording' })
  async uploadRecording(
    @Param('id') callId: string,
    @TenantId() tenantId: string,
    @Query('tenantId') queryTenantId: string,
    @Body() dto: { sizeBytes?: number; durationSec?: number; mimeType?: string },
  ): Promise<any> {
    const effectiveTenantId = tenantId || queryTenantId;
    if (!effectiveTenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.videoCallService.attachRecording(callId, effectiveTenantId, dto);
  }

  @Post(':id/recordings/start')
  @RequirePermissions('video_call:join')
  @ApiOperation({ summary: 'Start recording the video call room' })
  async startRecording(@Param('id') callId: string, @TenantId() tenantId: string): Promise<any> {
    return this.videoCallService.startRoomRecording(callId, tenantId);
  }

  @Post(':id/recordings/stop')
  @RequirePermissions('video_call:join')
  @ApiOperation({ summary: 'Stop recording the video call room' })
  async stopRecording(
    @Param('id') callId: string,
    @TenantId() tenantId: string,
    @Body() dto: { recordingId?: string },
  ): Promise<any> {
    return this.videoCallService.stopRoomRecording(callId, tenantId, dto.recordingId);
  }

  @Get('assets')
  @RequirePermissions('video_call:view')
  @ApiOperation({ summary: 'List MinIO-stored assets across video calls' })
  async listAssets(@TenantId() tenantId: string, @Query('type') type?: string): Promise<any> {
    return this.videoCallService.listAllCallAssets(tenantId, type);
  }

  @Get(':id/assets')
  @RequirePermissions('video_call:join')
  @ApiOperation({ summary: 'List MinIO-stored assets for a video call' })
  async getAssets(
    @Param('id') callId: string,
    @TenantId() tenantId: string,
    @Query('type') type?: string,
  ): Promise<any> {
    return this.videoCallService.listCallAssets(callId, tenantId, type);
  }

  @Get(':id')
  @RequirePermissions('video_call:view')
  @ApiOperation({ summary: 'Get details of a specific video call' })
  async getCall(@Param('id') callId: string, @TenantId() tenantId: string): Promise<any> {
    return this.videoCallService.getCall(callId, tenantId);
  }

  @Patch(':id')
  @RequirePermissions('video_call:join')
  @ApiOperation({ summary: 'Update visitor details and notes for a video call' })
  async updateCall(
    @Param('id') callId: string,
    @TenantId() tenantId: string,
    @Body()
    dto: {
      visitorName?: string;
      visitorEmail?: string;
      visitorPhone?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<any> {
    return this.videoCallService.updateCall(callId, tenantId, dto);
  }

  @Get()
  @RequirePermissions('video_call:view')
  @ApiOperation({ summary: 'List past video calls for organization' })
  async listCalls(
    @TenantId() tenantId: string,
    @Query('limit') limit?: number,
    @Query('page') page?: number,
  ): Promise<any> {
    return this.videoCallService.listCalls(tenantId, limit || 20, page || 1);
  }
}

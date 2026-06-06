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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { VideoCallService } from './video-call.service';
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

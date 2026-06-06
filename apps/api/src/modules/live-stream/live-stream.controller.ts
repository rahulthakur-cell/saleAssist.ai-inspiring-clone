import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LiveStreamService } from './live-stream.service';
import { CreateStreamDto, AddProductDto, ChatMessageDto } from './dto/create-stream.dto';
import { JoinCallDto } from '../video-call/dto/create-call.dto';
import { JwtAuthGuard, RbacGuard } from '../../common/guards';
import { CurrentUser, Public, TenantId, RequirePermissions } from '../../common/decorators';

@ApiTags('Live Streams')
@Controller('live-streams')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class LiveStreamController {
  constructor(private readonly liveStreamService: LiveStreamService) {}

  @Post()
  @RequirePermissions('video_call:create') // Agents/Admins can schedule streams
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create or schedule a live stream' })
  async createStream(@TenantId() tenantId: string, @Body() dto: CreateStreamDto): Promise<any> {
    return this.liveStreamService.createStream(tenantId, dto);
  }

  @Post(':id/start')
  @RequirePermissions('video_call:join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start streaming (Go Live)' })
  async startStream(@Param('id') streamId: string, @TenantId() tenantId: string): Promise<any> {
    return this.liveStreamService.startStream(streamId, tenantId);
  }

  @Post(':id/end')
  @RequirePermissions('video_call:join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End the live stream' })
  async endStream(@Param('id') streamId: string, @TenantId() tenantId: string): Promise<any> {
    return this.liveStreamService.endStream(streamId, tenantId);
  }

  @Post(':id/join')
  @Public() // Allow public viewers to join
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a live stream room' })
  async joinStream(
    @Param('id') streamId: string,
    @TenantId() tenantId: string,
    @Body() dto: JoinCallDto,
    @Req() req: any,
  ): Promise<any> {
    let userId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const payload = req.user || {};
        userId = payload.sub || null;
      } catch {}
    }

    if (req.user && req.user.sub) {
      userId = req.user.sub;
    }

    return this.liveStreamService.joinStream(streamId, tenantId, userId, dto.participantName);
  }

  @Post(':id/products')
  @RequirePermissions('video_call:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a shoppable product to a stream' })
  async addProduct(
    @Param('id') streamId: string,
    @TenantId() tenantId: string,
    @Body() dto: AddProductDto,
  ): Promise<any> {
    return this.liveStreamService.addProduct(streamId, tenantId, dto);
  }

  @Delete(':id/products/:pid')
  @RequirePermissions('video_call:create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a product from stream' })
  async removeProduct(
    @Param('id') streamId: string,
    @Param('pid') productId: string,
    @TenantId() tenantId: string,
  ): Promise<any> {
    return this.liveStreamService.removeProduct(streamId, productId, tenantId);
  }

  @Post(':id/feature/:pid')
  @RequirePermissions('video_call:join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Feature a product in real-time during stream' })
  async featureProduct(
    @Param('id') streamId: string,
    @Param('pid') productId: string,
    @TenantId() tenantId: string,
  ): Promise<any> {
    return this.liveStreamService.featureProduct(streamId, productId, tenantId);
  }

  @Get(':id')
  @Public() // Allow public viewers to pull stream details & products
  @ApiOperation({ summary: 'Get stream details' })
  async getStream(@Param('id') streamId: string, @TenantId() tenantId: string): Promise<any> {
    return this.liveStreamService.getStream(streamId, tenantId);
  }

  @Get()
  @Public() // Allow widget / public clients to list active streams
  @ApiOperation({ summary: 'List live streams' })
  async listStreams(
    @TenantId() tenantId: string,
    @Query('limit') limit?: number,
    @Query('page') page?: number,
  ): Promise<any> {
    return this.liveStreamService.listStreams(tenantId, limit || 20, page || 1);
  }
}

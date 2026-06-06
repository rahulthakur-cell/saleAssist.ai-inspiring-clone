import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShoppableVideoService } from './shoppable-video.service';
import { CreateVideoDto, UpdateVideoDto, CreateHotspotDto } from './dto/create-video.dto';
import { JwtAuthGuard, RbacGuard } from '../../common/guards';
import { Public, TenantId, RequirePermissions } from '../../common/decorators';

@ApiTags('Shoppable Videos')
@Controller('shoppable-videos')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class ShoppableVideoController {
  constructor(private readonly shoppableVideoService: ShoppableVideoService) {}

  @Post()
  @RequirePermissions('settings:manage') // Admins/managers can upload videos
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload and register a shoppable video' })
  async createVideo(@TenantId() tenantId: string, @Body() dto: CreateVideoDto): Promise<any> {
    return this.shoppableVideoService.createVideo(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'Update shoppable video metadata' })
  async updateVideo(
    @Param('id') videoId: string,
    @TenantId() tenantId: string,
    @Body() dto: UpdateVideoDto,
  ): Promise<any> {
    return this.shoppableVideoService.updateVideo(videoId, tenantId, dto);
  }

  @Get()
  @Public() // Allow public widgets and storefronts to list videos
  @ApiOperation({ summary: 'List shoppable videos' })
  async listVideos(
    @TenantId() tenantId: string,
    @Query('limit') limit?: number,
    @Query('page') page?: number,
  ): Promise<any> {
    return this.shoppableVideoService.listVideos(tenantId, limit || 20, page || 1);
  }

  @Get(':id')
  @Public() // Allow public widgets to get video & hotspot metadata
  @ApiOperation({ summary: 'Get shoppable video details' })
  async getVideo(@Param('id') videoId: string, @TenantId() tenantId: string): Promise<any> {
    return this.shoppableVideoService.getVideo(videoId, tenantId);
  }

  @Delete(':id')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'Delete a shoppable video' })
  async deleteVideo(@Param('id') videoId: string, @TenantId() tenantId: string): Promise<any> {
    return this.shoppableVideoService.deleteVideo(videoId, tenantId);
  }

  @Post(':id/hotspots')
  @RequirePermissions('settings:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a shoppable product hotspot to a video' })
  async addHotspot(
    @Param('id') videoId: string,
    @TenantId() tenantId: string,
    @Body() dto: CreateHotspotDto,
  ): Promise<any> {
    return this.shoppableVideoService.addHotspot(videoId, tenantId, dto);
  }

  @Delete(':id/hotspots/:hid')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'Remove a hotspot from video' })
  async deleteHotspot(
    @Param('id') videoId: string,
    @Param('hid') hotspotId: string,
    @TenantId() tenantId: string,
  ): Promise<any> {
    return this.shoppableVideoService.deleteHotspot(videoId, hotspotId, tenantId);
  }
}

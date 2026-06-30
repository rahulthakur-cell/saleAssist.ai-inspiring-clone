import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { JwtAuthGuard, RbacGuard } from '../../common/guards';
import { Public, TenantId } from '../../common/decorators';
import { nanoid } from 'nanoid';

@ApiTags('Storage')
@Controller('storage')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('presigned-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate presigned S3 upload URL for direct uploads' })
  async getUploadUrl(
    @TenantId() tenantId: string,
    @Body() dto: PresignedUrlDto,
  ): Promise<any> {
    // Sanitize filename to avoid folder escape
    const fileExtension = dto.fileName.split('.').pop();
    const sanitizedName = `${nanoid(16)}.${fileExtension}`;

    // Namespace object under the tenant folder
    const objectName = `${tenantId}/${sanitizedName}`;

    const uploadUrl = await this.storageService.getPresignedUploadUrl(objectName);
    const publicUrl = this.storageService.getPublicUrl(objectName);
    const streamUrl = this.storageService.getStreamUrl(objectName);

    return {
      uploadUrl,
      publicUrl,
      streamUrl,
      objectName,
    };
  }

  /**
   * GET /storage/stream/:tenantId/:fileName
   * Redirects to a fresh presigned S3 GET URL for streaming/download.
   * This avoids exposing raw MinIO credentials to the frontend while supporting
   * HTTP Range requests (browsers need these for video seek/scrub support).
   */
  @Get('stream/:tenantId/:fileName')
  @Public()
  @ApiOperation({ summary: 'Redirects to a fresh presigned S3 GET URL for streaming/download' })
  async streamFile(
    @Param('tenantId') tenantId: string,
    @Param('fileName') fileName: string,
    @Res() res: any,
  ) {
    const objectName = `${tenantId}/${fileName}`;
    try {
      const presignedGetUrl = await this.storageService.getPresignedGetUrl(objectName);
      // Required: browsers block cross-origin media loads unless CORP is set to cross-origin.
      // Without this, <video> elements on localhost:3000 cannot load from localhost:4000.
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.redirect(presignedGetUrl);
    } catch (err: any) {
      return res.status(404).json({ message: 'File not found or storage error', error: err.message });
    }
  }
}


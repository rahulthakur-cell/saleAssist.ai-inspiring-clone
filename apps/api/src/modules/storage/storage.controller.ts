import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { JwtAuthGuard, RbacGuard } from '../../common/guards';
import { TenantId } from '../../common/decorators';
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

    return {
      uploadUrl,
      publicUrl,
      objectName,
    };
  }
}

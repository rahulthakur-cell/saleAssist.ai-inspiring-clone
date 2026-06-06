import {
  Controller,
  Post,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard, RbacGuard } from '../../common/guards';
import { RequirePermissions, TenantId } from '../../common/decorators';

@ApiTags('Search')
@Controller('search')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('reindex')
  @RequirePermissions('settings:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rebuild the complete search index in Meilisearch' })
  async reindex(@TenantId() tenantId: string): Promise<any> {
    return this.searchService.reindexAll(tenantId);
  }

  @Get()
  @RequirePermissions('video_call:view') // Agents dashboard view
  @ApiOperation({ summary: 'Query the global search index' })
  async querySearch(
    @TenantId() tenantId: string,
    @Query('q') query: string,
  ): Promise<any[]> {
    return this.searchService.search(tenantId, query || '');
  }
}

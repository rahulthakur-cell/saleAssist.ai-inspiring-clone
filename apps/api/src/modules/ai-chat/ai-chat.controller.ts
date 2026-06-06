import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Sse,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiChatService } from './ai-chat.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { JwtAuthGuard, RbacGuard } from '../../common/guards';
import { Public, TenantId, RequirePermissions } from '../../common/decorators';
import { Observable } from 'rxjs';

@ApiTags('AI Chat')
@Controller('ai-chat')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('sessions')
  @Public() // Allow anonymous visitors to initiate chat sessions
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a new AI chat support session' })
  async createSession(
    @TenantId() tenantId: string,
    @Body() dto: CreateSessionDto,
    @Req() req: any,
  ): Promise<any> {
    const visitorId = req.visitorId || undefined;
    return this.aiChatService.createSession(tenantId, dto, visitorId);
  }

  @Get('sessions')
  @RequirePermissions('video_call:view') // Agents view all sessions
  @ApiOperation({ summary: 'List chat sessions' })
  async listSessions(@TenantId() tenantId: string): Promise<any> {
    return this.aiChatService.listSessions(tenantId);
  }

  @Get('sessions/:id')
  @Public() // Allow visitors to load their chat history
  @ApiOperation({ summary: 'Get details and chat history of a session' })
  async getSession(@Param('id') sessionId: string, @TenantId() tenantId: string): Promise<any> {
    return this.aiChatService.getSession(sessionId, tenantId);
  }

  @Sse('sessions/:id/stream')
  @Public() // Allow visitors to connect to SSE stream
  @ApiOperation({ summary: 'Stream response tokens via Server-Sent Events (SSE)' })
  async streamResponse(
    @Param('id') sessionId: string,
    @TenantId() tenantId: string,
    @Query('message') message: string,
  ): Promise<Observable<any>> {
    return this.aiChatService.streamResponse(sessionId, tenantId, message || '');
  }
}

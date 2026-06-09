import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { ConfigService } from '@nestjs/config';
import { ChatMessageRole } from '@saleassist/database';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private readonly litellmUrl: string;
  private readonly litellmKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.litellmUrl = this.configService.get<string>('LITELLM_URL', 'http://localhost:4001');
    this.litellmKey = this.configService.get<string>('LITELLM_API_KEY', 'sk-litellm-dev-key');
  }

  /**
   * Creates a new AI support chat session.
   */
  async createSession(tenantId: string, dto: CreateSessionDto, visitorId?: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);
    return this.prisma.aiChatSession.create({
      data: {
        tenantId,
        visitorId: visitorId || null,
        title: dto.title || 'Support Chat Session',
        model: 'gpt-4o',
        systemPrompt: 'You are an AI sales assistant for our e-commerce store. Help visitors find products, answer FAQs, and collect contact details to schedule calls.',
      },
    });
  }

  /**
   * Lists chat sessions.
   */
  async listSessions(tenantId: string, visitorId?: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);
    return this.prisma.aiChatSession.findMany({
      where: {
        tenantId,
        ...(visitorId ? { visitorId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves chat logs.
   */
  async getSession(sessionId: string, tenantId: string): Promise<any> {
    await this.prisma.setTenantContext(tenantId);
    const session = await this.prisma.aiChatSession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) throw new NotFoundException('Chat session not found');

    return session;
  }

  /**
   * Streams token chunks from LiteLLM proxy, with mock fallbacks for local dev checks.
   */
  async streamResponse(
    sessionId: string,
    tenantId: string,
    userMessage: string,
  ): Promise<Observable<any>> {
    await this.prisma.setTenantContext(tenantId);

    const session = await this.prisma.aiChatSession.findFirst({
      where: { id: sessionId, tenantId },
      include: { messages: true },
    });

    if (!session) throw new NotFoundException('Chat session not found');

    // Save User message in DB
    await this.prisma.aiChatMessage.create({
      data: {
        sessionId,
        role: ChatMessageRole.USER,
        content: userMessage,
      },
    });

    // Prepare full chat payload history
    const history = session.messages.map((m: { role: string; content: string }) => ({
      role: m.role.toLowerCase(),
      content: m.content,
    }));
    
    // Add new user prompt
    history.push({ role: 'user', content: userMessage });

    // Prepend system prompt
    if (session.systemPrompt) {
      history.unshift({ role: 'system', content: session.systemPrompt });
    }

    const subject = new Subject<any>();

    // Call LLM asynchronously so NestJS SSE controller can capture it
    this.executeLlmStream(sessionId, history, subject);

    return subject.asObservable();
  }

  private async executeLlmStream(sessionId: string, messages: any[], subject: Subject<any>) {
    let responseText = '';
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(`${this.litellmUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.litellmKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages,
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok || !response.body) {
        throw new Error(`LiteLLM server returned status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete lines in buffer

        for (const line of lines) {
          const cleanedLine = line.trim();
          if (!cleanedLine) continue;
          if (cleanedLine === 'data: [DONE]') continue;

          if (cleanedLine.startsWith('data: ')) {
            try {
              const data = JSON.parse(cleanedLine.substring(6));
              const token = data.choices[0]?.delta?.content || '';
              if (token) {
                responseText += token;
                subject.next({ data: JSON.stringify({ token }) });
              }
            } catch {
              // Ignore parse errors on incomplete chunk lines
            }
          }
        }
      }

      // Finalize message storage in DB
      await this.saveAssistantMessage(sessionId, responseText);
      subject.complete();

    } catch (error: any) {
      this.logger.warn(`Failed to connect to LiteLLM server: ${error.message}. Running fallback simulator.`);
      
      // Fallback: Generate mock streaming tokens
      const mockResponse = `Hi! Thanks for your question: "${messages[messages.length - 1].content}". Since LiteLLM is not running, here is a mock response streaming back to you in real-time. How else can I help you?`;
      
      const words = mockResponse.split(' ');
      for (const word of words) {
        await new Promise((resolve) => setTimeout(resolve, 80)); // 80ms delay
        subject.next({ data: JSON.stringify({ token: word + ' ' }) });
        responseText += word + ' ';
      }

      await this.saveAssistantMessage(sessionId, responseText.trim());
      subject.complete();
    }
  }

  private async saveAssistantMessage(sessionId: string, content: string) {
    try {
      // Clear context or let super query handle it
      await this.prisma.aiChatMessage.create({
        data: {
          sessionId,
          role: ChatMessageRole.ASSISTANT,
          content,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to save assistant response: ${err.message}`);
    }
  }
}

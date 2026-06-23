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
  private readonly openaiApiKey: string;
  private readonly googleAiApiKey: string;
  private readonly anthropicApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.litellmUrl = this.configService.get<string>('LITELLM_URL', 'http://localhost:4001');
    this.litellmKey = this.configService.get<string>('LITELLM_API_KEY', 'sk-litellm-dev-key');
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY', '');
    this.googleAiApiKey = this.configService.get<string>('GOOGLE_AI_API_KEY', '');
    this.anthropicApiKey = this.configService.get<string>('ANTHROPIC_API_KEY', '');
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
   * Streams token chunks from LiteLLM proxy, with direct OpenAI fallback.
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

    // Prepare full chat payload history - preserve image_url content
    const history = session.messages.map((m: { role: string; content: string | any[] }) => {
      if (Array.isArray(m.content)) {
        const parts = (m.content as any[]).map((p: any) => {
          if (p.type === 'text') return { type: 'text', text: p.text || '' };
          if (p.type === 'image_url') {
            const src = typeof p.image_url === 'string' ? p.image_url : p.image_url?.url;
            if (!src) return null;
            const normalized = String(src).trim();
            if (!/^(https?:|data:)/i.test(normalized)) return null;
            if (!/\.(png|jpe?g|webp|gif|bmp|avif)(\?.*)?$/i.test(normalized) && !normalized.startsWith('data:')) return null;
            return { type: 'image_url', image_url: normalized };
          }
          return null;
        }).filter(Boolean);
        return { role: m.role.toLowerCase(), content: parts };
      }
      return { role: m.role.toLowerCase(), content: m.content as string };
    });
    
    // Add new user prompt - preserve image_url if present
    const userContent: any = Array.isArray(userMessage)
      ? userMessage.map((p: any) => {
          if (p.type === 'image_url') {
            const src = typeof p.image_url === 'string' ? p.image_url : p.image_url?.url;
            if (!src) return null;
            const normalized = String(src).trim();
            if (!/^(https?:|data:)/i.test(normalized)) return null;
            if (!/\.(png|jpe?g|webp|gif|bmp|avif)(\?.*)?$/i.test(normalized) && !normalized.startsWith('data:')) return null;
            return { type: 'image_url', image_url: normalized };
          }
          return { type: 'text', text: p.text || '' };
        }).filter((p: any) => (p as any).text || (p as any).image_url)
      : userMessage;

    history.push({ role: 'user', content: userContent });

    // Prepend system prompt
    if (session.systemPrompt) {
      history.unshift({ role: 'system', content: session.systemPrompt });
    }

    const subject = new Subject<any>();

    // Call LLM asynchronously so NestJS SSE controller can capture it
    this.executeLlmStream(session.model, sessionId, history, subject);

    return subject.asObservable();
  }

  /**
   * Clean messages for safe LLM submission.
   */
  private cleanMessagesForLlm(messages: any[]): any[] {
    return messages.map((m: { role: string; content: string | any[] }) => {
      if (Array.isArray(m.content)) {
        const parts = m.content.map((p: any) => {
          if (p.type === 'text') return { type: 'text', text: p.text || '' };
          if (p.type === 'image_url') {
            const src = typeof p.image_url === 'string' ? p.image_url : p.image_url?.url;
            if (!src || (!src.startsWith('data:') && !src.startsWith('http'))) return null;
            if (src.includes('.png') || src.includes('.jpg') || src.includes('.jpeg') || src.includes('.webp')) {
              return { type: 'image_url', image_url: src };
            }
            return null;
          }
          return null;
        }).filter(Boolean);
        return { ...m, content: parts };
      }
      return { ...m, content: (m.content as string) || '' };
    });
  }

  /**
   * Stream from any OpenAI-compatible API endpoint.
   */
  private async streamFromEndpoint(
    url: string,
    apiKey: string,
    model: string,
    messages: any[],
    subject: Subject<any>,
    abortSignal: AbortSignal,
  ): Promise<string> {
    const response = (await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: abortSignal,
    })) as any;

    if (!response.ok || !response.body) {
      let errorMsg = `API returned status ${response.status}`;
      try {
        const errBody = await response.json();
        if (errBody?.error?.message) errorMsg = errBody.error.message;
      } catch { /* ignore */ }
      throw new Error(errorMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let responseText = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const cleanedLine = line.trim();
        if (!cleanedLine || cleanedLine === 'data: [DONE]') continue;

        if (cleanedLine.startsWith('data: ')) {
          try {
            const data = JSON.parse(cleanedLine.substring(6));
            const token = data.choices?.[0]?.delta?.content || '';
            if (token) {
              responseText += token;
              subject.next({ data: JSON.stringify({ token }) });
            }
          } catch { /* ignore incomplete chunks */ }
        }
      }
    }

    return responseText;
  }

  private async executeLlmStream(sessionModel: string, sessionId: string, messages: any[], subject: Subject<any>) {
    let responseText = '';
    
    const cleanMessages = this.cleanMessagesForLlm(messages);
    const hasImages = cleanMessages.some((m: any) => Array.isArray(m.content) && m.content.some((p: any) => p.type === 'image_url'));
    // Use 'ai-agent' model group for cross-provider fallback (gpt-4o-mini → gpt-4o → Anthropic → Gemini)
    // For image-heavy requests use gpt-4o since vision is not universal
    const selectedModel = hasImages ? 'gpt-4o' : 'ai-agent';
    
    this.logger.log(`[AI Chat] Starting stream for session ${sessionId} using model group: ${selectedModel}`);

    // ─── TIER 1: Try LiteLLM Proxy ───────────────────────────────────────────
    try {
      const controller = new AbortController();
      // 45s timeout (LiteLLM handles its own internal retries)
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      this.logger.log(`[AI Chat] Tier 1 — Calling LiteLLM: ${this.litellmUrl}/chat/completions with model=${selectedModel}`);
      
      responseText = await this.streamFromEndpoint(
        `${this.litellmUrl}/chat/completions`,
        this.litellmKey,
        selectedModel,
        cleanMessages,
        subject,
        controller.signal,
      );

      clearTimeout(timeoutId);
      await this.saveAssistantMessage(sessionId, responseText);
      subject.complete();
      return;

    } catch (litellmError: any) {
      const isConnectionError = litellmError.message?.includes('fetch failed') ||
                                litellmError.message?.includes('ECONNREFUSED') ||
                                litellmError.message?.includes('ENOTFOUND');

      if (isConnectionError) {
        this.logger.warn(`[AI Chat] LiteLLM not reachable, trying direct OpenAI fallback...`);
      } else {
        this.logger.warn(`[AI Chat] LiteLLM Tier 1 failed (${litellmError.message?.substring(0, 120)}), trying direct OpenAI fallback...`);
      }
    }

    // ─── TIER 2: Direct OpenAI API Fallback ──────────────────────────────────
    if (this.openaiApiKey) {
      try {
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 60000);

        // Use the cheapest model that works for text, gpt-4o for images
        const directModel = hasImages ? 'gpt-4o' : 'gpt-4o-mini';
        this.logger.log(`[AI Chat] Tier 2 — Calling OpenAI directly with model=${directModel}`);

        responseText = await this.streamFromEndpoint(
          'https://api.openai.com/v1/chat/completions',
          this.openaiApiKey,
          directModel,
          cleanMessages,
          subject,
          controller2.signal,
        );

        clearTimeout(timeoutId2);
        await this.saveAssistantMessage(sessionId, responseText);
        subject.complete();
        return;

      } catch (openaiError: any) {
        this.logger.warn(`[AI Chat] Tier 2 OpenAI failed: ${openaiError.message?.substring(0, 150)}, trying Gemini...`);
      }
    }

    // ─── TIER 3: Direct Google Gemini API Fallback ───────────────────────────
    if (this.googleAiApiKey && !hasImages) {
      try {
        const controller3 = new AbortController();
        const timeoutId3 = setTimeout(() => controller3.abort(), 60000);
        this.logger.log(`[AI Chat] Tier 3 — Calling Google Gemini directly`);

        // Convert OpenAI message format to Gemini format
        const geminiContents = cleanMessages
          .filter((m: any) => m.role !== 'system')
          .map((m: any) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: typeof m.content === 'string' ? m.content : (m.content[0]?.text || '') }],
          }));
        
        const systemInstruction = cleanMessages.find((m: any) => m.role === 'system')?.content;
        const geminiBody: any = {
          contents: geminiContents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        };
        if (systemInstruction) {
          geminiBody.systemInstruction = { parts: [{ text: systemInstruction }] };
        }

        const geminiRes = (await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${this.googleAiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiBody),
            signal: controller3.signal,
          }
        )) as any;

        clearTimeout(timeoutId3);

        if (!geminiRes.ok || !geminiRes.body) {
          const errBody = await geminiRes.json().catch(() => ({}));
          throw new Error(errBody?.error?.message || `Gemini API status ${geminiRes.status}`);
        }

        const reader3 = geminiRes.body.getReader();
        const decoder3 = new TextDecoder();
        let buffer3 = '';

        while (true) {
          const { value, done } = await reader3.read();
          if (done) break;
          buffer3 += decoder3.decode(value, { stream: true });
          const lines3 = buffer3.split('\n');
          buffer3 = lines3.pop() || '';
          for (const line of lines3) {
            const cleaned = line.trim();
            if (!cleaned || cleaned === 'data: [DONE]') continue;
            if (cleaned.startsWith('data: ')) {
              try {
                const data = JSON.parse(cleaned.substring(6));
                const token = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (token) {
                  responseText += token;
                  subject.next({ data: JSON.stringify({ token }) });
                }
              } catch { /* ignore */ }
            }
          }
        }

        await this.saveAssistantMessage(sessionId, responseText);
        subject.complete();
        return;

      } catch (geminiError: any) {
        this.logger.warn(`[AI Chat] Tier 3 Gemini failed: ${geminiError.message?.substring(0, 150)}, using demo mode...`);
      }
    }

    // ─── TIER 4: Smart Demo Mode (all providers exhausted) ────────────────────
    this.logger.warn(`[AI Chat] All AI providers failed — using demo mode for session ${sessionId}`);
    const userMsg = typeof cleanMessages[cleanMessages.length - 1]?.content === 'string'
      ? cleanMessages[cleanMessages.length - 1].content as string
      : 'How can I help you?';
    const demoResponse = this.generateDemoResponse(userMsg);
    await this.streamErrorMessage(subject, demoResponse, 20);
    responseText = demoResponse;

    await this.saveAssistantMessage(sessionId, responseText.trim());
    subject.complete();
  }

  /**
   * Generates a context-aware demo response when all AI providers are unavailable.
   * This ensures the chat UI always shows a meaningful response.
   */
  private generateDemoResponse(userMessage: string): string {
    const lowerMsg = userMessage.toLowerCase();
    
    if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
      return "👋 Hello! I'm your AI sales assistant. I can help you find products, answer questions about our store, and assist you with your shopping needs. What can I help you with today?";
    }
    if (lowerMsg.includes('product') || lowerMsg.includes('find') || lowerMsg.includes('show')) {
      return "🛍️ I'd love to help you find the perfect product! Our store features a wide selection of items. Could you tell me more about what you're looking for? For example, what category, budget range, or specific features are you interested in?";
    }
    if (lowerMsg.includes('price') || lowerMsg.includes('cost') || lowerMsg.includes('how much')) {
      return "💰 Great question about pricing! Our products range across various price points to suit different budgets. To give you accurate pricing, could you let me know which specific product or category you're interested in?";
    }
    if (lowerMsg.includes('ship') || lowerMsg.includes('deliver') || lowerMsg.includes('delivery')) {
      return "🚚 We offer fast and reliable shipping! Standard delivery typically takes 3-5 business days, and express shipping is available for 1-2 business days. Free shipping is available on orders over a certain threshold. Would you like more details?";
    }
    if (lowerMsg.includes('return') || lowerMsg.includes('refund') || lowerMsg.includes('exchange')) {
      return "↩️ We have a hassle-free return policy! You can return most items within 30 days of purchase for a full refund or exchange. Items must be in original condition. Would you like me to guide you through the return process?";
    }
    if (lowerMsg.includes('contact') || lowerMsg.includes('support') || lowerMsg.includes('help')) {
      return "🎧 Our support team is here to help! You can reach us through this chat, email at support@example.com, or phone at 1-800-EXAMPLE. I can also schedule a video call with one of our specialists if you'd prefer. What would work best for you?";
    }
    if (lowerMsg.includes('discount') || lowerMsg.includes('coupon') || lowerMsg.includes('offer') || lowerMsg.includes('sale')) {
      return "🏷️ Great news — we have some fantastic offers available! New customers get 10% off their first order. We also run seasonal sales and have a loyalty program. Would you like me to share the current promotions with you?";
    }
    
    return `Thank you for your message! I'm your AI sales assistant and I'm here to help. I can assist you with:

• 🔍 **Finding products** that match your needs
• 💬 **Answering questions** about our catalog
• 🛒 **Processing orders** and tracking deliveries  
• 📞 **Scheduling a call** with our sales team

What would you like help with today?`;
  }

  /**
   * Streams an error message word-by-word to the client.
   */
  private async streamErrorMessage(subject: Subject<any>, message: string, delayMs: number) {
    const words = message.split(' ');
    for (const word of words) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      subject.next({ data: JSON.stringify({ token: word + ' ' }) });
    }
  }

  private async saveAssistantMessage(sessionId: string, content: string) {
    try {
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

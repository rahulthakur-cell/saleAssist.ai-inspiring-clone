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
        model: 'gemini-2.5-flash',
        systemPrompt: `You are SaleAssist AI, an intelligent sales assistant embedded on an e-commerce website. Your goal is to help visitors:
1. Find the right products based on their needs and budget
2. Answer questions about products, pricing, shipping, returns, and promotions
3. Collect contact details (name, email, phone) to schedule follow-up calls with the sales team
4. Recommend relevant products and upsell/cross-sell where appropriate

Be concise, friendly, and professional. Always give direct, specific answers. If you don't know something specific about this store's inventory, say so honestly and offer to connect them with a sales representative. Format responses in clean markdown when helpful.`,
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
   * Streams token chunks from LiteLLM proxy, with multi-tier fallbacks.
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

    // Fetch real store context to enrich the system prompt
    const storeContext = await this.loadStoreContext(tenantId);

    // Prepend enriched system prompt
    const baseSystemPrompt = session.systemPrompt || 
      'You are SaleAssist AI, a helpful sales assistant for this e-commerce store.';
    const enrichedSystemPrompt = storeContext
      ? `${baseSystemPrompt}\n\n--- CURRENT STORE DATA ---\n${storeContext}`
      : baseSystemPrompt;

    history.unshift({ role: 'system', content: enrichedSystemPrompt });

    const subject = new Subject<any>();

    // Call LLM asynchronously so NestJS SSE controller can capture it
    this.executeLlmStream(session.model, sessionId, tenantId, history, subject);

    return subject.asObservable();
  }

  /**
   * Loads real store context from the database to enrich AI responses.
   */
  private async loadStoreContext(tenantId: string): Promise<string> {
    try {
      await this.prisma.setTenantContext(tenantId);

      // Fetch shoppable videos with hotspots (products)
      const videos = await this.prisma.shoppableVideo.findMany({
        where: { tenantId },
        include: {
          hotspots: { take: 10 },
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }).catch(() => []);

      // Fetch video FAQs
      const faqs = await this.prisma.videoFaq.findMany({
        where: { tenantId },
        include: { items: { take: 5 } },
        take: 5,
      }).catch(() => []);

      const contextParts: string[] = [];

      if (videos.length > 0) {
        const videoLines = videos.map((v: any) => {
          const hotspotList = v.hotspots?.map((h: any) => 
            `  - ${h.productName || 'Product'}: $${h.price || '?'} — [Product Link](${h.productUrl || '#'})`
          ).join('\n') || '';
          return `**Shoppable Video: ${v.title}**\nURL: ${v.videoUrl || ''}\nProducts tagged in this video:\n${hotspotList || '  (no products tagged)'}`;
        });
        contextParts.push('## Shoppable Video Products\n' + videoLines.join('\n\n'));
      }

      if (faqs.length > 0) {
        const faqLines = faqs.map((f: any) => {
          const items = f.items?.map((item: any) => `  Q: ${item.question}\n  A: Watch video explanation at ${item.videoUrl || '#'}`).join('\n') || '';
          return `**Video FAQ Category: ${f.title}**\n${items}`;
        });
        contextParts.push('## Video FAQ Catalog\n' + faqLines.join('\n\n'));
      }

      return contextParts.join('\n\n');
    } catch (err: any) {
      this.logger.warn(`[AI Chat] Could not load store context: ${err.message}`);
      return '';
    }
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

  /**
   * Stream from the Gemini API (non-OpenAI format).
   */
  private async streamFromGemini(
    model: string,
    messages: any[],
    subject: Subject<any>,
    abortSignal: AbortSignal,
  ): Promise<string> {
    // Convert OpenAI message format to Gemini format
    const geminiContents = messages
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : (m.content[0]?.text || '') }],
      }));

    // Ensure we don't have consecutive messages with the same role (Gemini requires alternation)
    const dedupedContents: any[] = [];
    for (const msg of geminiContents) {
      if (dedupedContents.length > 0 && dedupedContents[dedupedContents.length - 1].role === msg.role) {
        // Merge with previous message
        dedupedContents[dedupedContents.length - 1].parts[0].text += '\n' + msg.parts[0].text;
      } else {
        dedupedContents.push(msg);
      }
    }

    const systemInstruction = messages.find((m: any) => m.role === 'system')?.content;
    const geminiBody: any = {
      contents: dedupedContents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    };
    if (systemInstruction) {
      geminiBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const geminiRes = (await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${this.googleAiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
        signal: abortSignal,
      }
    )) as any;

    if (!geminiRes.ok || !geminiRes.body) {
      const errBody = await geminiRes.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Gemini API status ${geminiRes.status}`);
    }

    const reader3 = geminiRes.body.getReader();
    const decoder3 = new TextDecoder();
    let buffer3 = '';
    let responseText = '';

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

    return responseText;
  }

  private async executeLlmStream(
    sessionModel: string,
    sessionId: string,
    tenantId: string,
    messages: any[],
    subject: Subject<any>,
  ) {
    let responseText = '';
    
    const cleanMessages = this.cleanMessagesForLlm(messages);
    const hasImages = cleanMessages.some((m: any) => Array.isArray(m.content) && m.content.some((p: any) => p.type === 'image_url'));
    // Use 'ai-agent' model group for cross-provider fallback
    const selectedModel = hasImages ? 'gpt-4o' : 'ai-agent';
    
    this.logger.log(`[AI Chat] Starting stream for session ${sessionId} using model group: ${selectedModel}`);

    // Parse and auto-create contact details in CRM if visitor provides them
    try {
      const lastUserMsg = cleanMessages[cleanMessages.length - 1]?.content;
      if (typeof lastUserMsg === 'string') {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const phoneRegex = /(\+?\d{1,4}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
        const emails = lastUserMsg.match(emailRegex);
        const phones = lastUserMsg.match(phoneRegex);

        if (emails && emails.length > 0) {
          const email = emails[0].toLowerCase();
          const phone = phones && phones.length > 0 ? phones[0] : null;
          
          // Try to extract name
          let firstName = 'Visitor';
          const nameMatch = lastUserMsg.match(/(?:my name is|i am|this is)\s+([a-zA-Z]+)(?:\s+([a-zA-Z]+))?/i);
          if (nameMatch && nameMatch[1]) {
            firstName = nameMatch[1];
          }

          await this.prisma.setTenantContext(tenantId);
          const existing = await this.prisma.contact.findFirst({
            where: { tenantId, email }
          });
          if (!existing) {
            await this.prisma.contact.create({
              data: {
                tenantId,
                email,
                phone,
                firstName,
                source: 'AI_CHAT',
                tags: ['AI-Captured']
              }
            });
            this.logger.log(`[AI Chat] Automatically created CRM contact: ${email}`);
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`[AI Chat] Failed to auto-create contact: ${err.message}`);
    }

    // ─── TIER 1: Try LiteLLM Proxy ───────────────────────────────────────────
    try {
      const controller = new AbortController();
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

    // ─── TIER 3: Direct Google Gemini API Fallback (2.5-flash first, then 2.0-flash) ──────────────────────────────
    if (this.googleAiApiKey && !hasImages) {
      // Try gemini-2.5-flash first (more capable and available)
      for (const geminiModel of ['gemini-2.5-flash', 'gemini-2.0-flash']) {
        try {
          const controller3 = new AbortController();
          const timeoutId3 = setTimeout(() => controller3.abort(), 60000);
          this.logger.log(`[AI Chat] Tier 3 — Calling Google Gemini directly with model=${geminiModel}`);

          responseText = await this.streamFromGemini(
            geminiModel,
            cleanMessages,
            subject,
            controller3.signal,
          );

          clearTimeout(timeoutId3);

          if (responseText) {
            await this.saveAssistantMessage(sessionId, responseText);
            subject.complete();
            return;
          }

        } catch (geminiError: any) {
          this.logger.warn(`[AI Chat] Tier 3 Gemini (${geminiModel}) failed: ${geminiError.message?.substring(0, 150)}`);
          // Continue to next model
        }
      }

      this.logger.warn(`[AI Chat] All Gemini models failed, using smart demo mode...`);
    }

    // ─── TIER 4: Smart Demo Mode with Real Store Data ────────────────────────
    this.logger.warn(`[AI Chat] All AI providers failed — using smart demo mode for session ${sessionId}`);
    const userMsg = typeof cleanMessages[cleanMessages.length - 1]?.content === 'string'
      ? cleanMessages[cleanMessages.length - 1].content as string
      : 'How can I help you?';
    
    const demoResponse = await this.generateSmartDemoResponse(userMsg, tenantId, cleanMessages);
    await this.streamErrorMessage(subject, demoResponse, 18);
    responseText = demoResponse;

    await this.saveAssistantMessage(sessionId, responseText.trim());
    subject.complete();
  }

  /**
   * Generates a smart, context-aware demo response using real store data from the DB.
   * This runs when all AI providers are unavailable.
   */
  private async generateSmartDemoResponse(userMessage: string, tenantId: string, fullHistory: any[]): Promise<string> {
    const lowerMsg = userMessage.toLowerCase();

    // Fetch real store data
    let videos: any[] = [];
    let faqs: any[] = [];
    let liveStreamProducts: any[] = [];
    let hotspots: any[] = [];

    try {
      await this.prisma.setTenantContext(tenantId);
      
      videos = await this.prisma.shoppableVideo.findMany({
        where: { tenantId },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }).catch(() => []);

      hotspots = await this.prisma.videoHotspot.findMany({
        where: {
          video: {
            tenantId
          }
        },
        include: {
          video: true
        }
      }).catch(() => []);

      liveStreamProducts = await this.prisma.liveStreamProduct.findMany({
        where: {
          liveStream: {
            tenantId
          }
        },
        include: {
          liveStream: true
        }
      }).catch(() => []);

      faqs = await this.prisma.videoFaq.findMany({
        where: { tenantId },
        include: { items: { take: 10 } },
        take: 5,
      }).catch(() => []);
    } catch (err: any) {
      this.logger.warn(`[AI Chat Demo] Error loading db context: ${err.message}`);
    }

    // Combine hotspots and live stream products
    const allProducts: any[] = [
      ...hotspots.map((h: any) => ({
        name: h.productName || 'Product',
        price: h.price ? Number(h.price) : null,
        currency: h.currency || 'USD',
        image: h.productImage,
        url: h.productUrl,
        type: 'video_product',
        sourceTitle: h.video?.title,
        videoUrl: h.video?.videoUrl
      })),
      ...liveStreamProducts.map((p: any) => ({
        name: p.productName || 'Product',
        price: p.price ? Number(p.price) : null,
        currency: p.currency || 'USD',
        image: p.productImage,
        url: p.productUrl,
        type: 'live_product',
        sourceTitle: p.liveStream?.title
      }))
    ];

    const allFaqItems = faqs.flatMap((f: any) =>
      (f.items || []).map((item: any) => ({
        q: item.question,
        videoUrl: item.videoUrl,
        thumbnailUrl: item.thumbnailUrl,
        category: f.title
      }))
    );

    // 1. Specific product match query
    const words = lowerMsg.split(/[\s,?.!]+/).filter((w: string) => w.length > 3);
    const matchedProducts = allProducts.filter((p: any) => {
      const productNameLower = p.name.toLowerCase();
      return words.some(word => productNameLower.includes(word));
    });

    if (matchedProducts.length > 0 && !lowerMsg.includes('price') && !lowerMsg.includes('cost')) {
      const productLines = matchedProducts.map((p: any) => {
        let line = `🛍️ **[${p.name}](${p.url || '#'})**`;
        if (p.price) line += ` — **${p.currency} ${p.price}**`;
        if (p.sourceTitle) {
          if (p.type === 'video_product') {
            line += `\n  *Featured in video:* [${p.sourceTitle}](${p.videoUrl || '#'})`;
          } else {
            line += `\n  *Featured in live stream:* ${p.sourceTitle}`;
          }
        }
        return line;
      }).join('\n\n');

      return `I found these products matching your request:\n\n${productLines}\n\nWould you like more details or want to watch their product videos?`;
    }

    // 2. FAQ / Question matching
    const matchedFaq = allFaqItems.find((item: any) => {
      const qWords = item.q.toLowerCase().split(/[\s,?.!]+/).filter((w: string) => w.length > 3);
      return qWords.some((word: string) => lowerMsg.includes(word));
    });

    if (matchedFaq) {
      return `📌 **FAQ: ${matchedFaq.q}**\n\nWe have a video answer for this question! You can watch the explanation here: [Watch Video](${matchedFaq.videoUrl || '#'}) ${matchedFaq.thumbnailUrl ? `\n\n![Video FAQ Thumbnail](${matchedFaq.thumbnailUrl})` : ''}\n\nIs there anything else I can help you with?`;
    }

    // 3. Greetings
    if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey') || lowerMsg.match(/^(hi|hey|hello)\b/)) {
      let greeting = `👋 Hello! I'm SaleAssist AI, your personal e-commerce assistant. I can help you find products, answer shipping and return questions, or schedule a live call with our sales team.`;
      if (allProducts.length > 0) {
        const sampleNames = allProducts.slice(0, 3).map((p: any) => `**${p.name}**`).join(', ');
        greeting += `\n\nWe currently feature products like: ${sampleNames}.`;
      }
      greeting += `\n\nWhat can I help you with today?`;
      return greeting;
    }

    // 4. Product list request
    if (lowerMsg.includes('product') || lowerMsg.includes('show') || lowerMsg.includes('what do you sell') || lowerMsg.includes('what do you have') || lowerMsg.includes('catalog')) {
      if (allProducts.length > 0) {
        const productList = allProducts.slice(0, 5).map((p: any) => {
          let itemStr = `• **[${p.name}](${p.url || '#'})**`;
          if (p.price) itemStr += ` — ${p.currency} ${p.price}`;
          if (p.sourceTitle) {
            itemStr += p.type === 'video_product'
              ? ` (Featured in: [${p.sourceTitle}](${p.videoUrl || '#'}))`
              : ` (Featured in: ${p.sourceTitle})`;
          }
          return itemStr;
        }).join('\n');
        return `🛍️ Here are some of our featured products:\n\n${productList}\n\nWould you like more details on any of these, or are you looking for a specific category?`;
      }
      return `🛍️ We carry a curated selection of products. Could you tell me what category or type of product you're looking for? I'll help you find the best match!`;
    }

    // 5. Price inquiries
    if (lowerMsg.includes('price') || lowerMsg.includes('cost') || lowerMsg.includes('how much') || lowerMsg.includes('cheap') || lowerMsg.includes('expensive')) {
      if (allProducts.length > 0) {
        const prices = allProducts.filter((p: any) => p.price).map((p: any) => Number(p.price));
        if (prices.length > 0) {
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const productPrices = allProducts.slice(0, 5).map((p: any) =>
            `• **[${p.name}](${p.url || '#'})**: ${p.currency} ${p.price}`
          ).join('\n');
          return `💰 Our products range from **${allProducts[0].currency} ${minPrice}** to **${allProducts[0].currency} ${maxPrice}**. Here is the pricing details:\n\n${productPrices}\n\nWould you like more details on a specific item?`;
        }
      }
      return `💰 Our pricing varies depending on the product. To get accurate pricing for what you're interested in, could you tell me which product or category you have in mind?`;
    }

    // 6. Shipping
    if (lowerMsg.includes('ship') || lowerMsg.includes('deliver') || lowerMsg.includes('how long')) {
      return `🚚 **Shipping Information:**\n\n• **Standard Delivery**: 3-5 business days\n• **Express Shipping**: 1-2 business days (additional charge)\n• **Free Shipping**: Available on qualifying orders\n\nWould you like to know the shipping cost for your order?`;
    }

    // 7. Returns
    if (lowerMsg.includes('return') || lowerMsg.includes('refund') || lowerMsg.includes('exchange') || lowerMsg.includes('cancel')) {
      return `↩️ **Return & Refund Policy:**\n\n• **30-day return window** for most items\n• Items must be in original, unused condition\n• Full refund or exchange available\n• Contact our support team to initiate a return\n\nWould you like me to connect you with our support team to process a return?`;
    }

    // 8. Contact / support / human / live call
    if (lowerMsg.includes('contact') || lowerMsg.includes('support') || lowerMsg.includes('speak') || lowerMsg.includes('agent') || lowerMsg.includes('human') || lowerMsg.includes('call')) {
      return `🎧 **Connect with Our Team:**\n\nI can arrange a video call with one of our product specialists for you! Just share your:\n• **Name**\n• **Email address**\n• **Phone number** (optional)\n• **Best time to call**\n\nAlternatively, you can request a live video call directly inside the widget by clicking the "Video Call" tab!`;
    }

    // 9. Discounts
    if (lowerMsg.includes('discount') || lowerMsg.includes('coupon') || lowerMsg.includes('offer') || lowerMsg.includes('deal') || lowerMsg.includes('promo') || lowerMsg.includes('sale')) {
      return `🏷️ **Current Promotions:**\n\n• **New customer discount**: 10% off your first order\n• **Bundle deals**: Save when buying multiple products\n• **Seasonal sales**: Check back regularly for limited-time offers\n\nWould you like me to apply a discount to your order or share more details about our promotions?`;
    }

    // 10. Video / demo content
    if (lowerMsg.includes('video') || lowerMsg.includes('demo') || lowerMsg.includes('watch')) {
      if (videos.length > 0) {
        const videoList = videos.slice(0, 5).map((v: any) => `• **[${v.title || 'Product Demo'}](${v.videoUrl || '#'})**`).join('\n');
        return `🎬 **Our Featured Shoppable Videos:**\n\n${videoList}\n\nYou can watch these demos directly on the widget to see our products in action. Would you like more details on any featured product?`;
      }
      return `🎬 We have product demo videos showcasing our items in action. Would you like me to guide you to a specific product video?`;
    }

    // Default contextual response
    const contextHint = allProducts.length > 0
      ? `\n\nBy the way, we currently feature **${allProducts.length}** products. Would you like to explore them?`
      : '';

    return `Thank you for your message! I'm SaleAssist AI and I'm here to help.

Here's what I can assist you with:

• 🔍 **Find products** that match your needs and budget
• 💬 **Answer questions** about pricing, shipping, and returns  
• 📞 **Schedule a call** with our sales specialists
• 🎬 **Explore product videos** and demonstrations${contextHint}

What would you like help with?`;
  }

  /**
   * Streams a message word-by-word to the client.
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

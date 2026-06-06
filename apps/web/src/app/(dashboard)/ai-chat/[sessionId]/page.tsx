'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Send,
  Bot,
  User,
  Sparkles,
  RefreshCw,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { aiChatApi } from '@/lib/api-client';

interface ChatMessage {
  id?: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt?: string;
}

interface ChatSession {
  id: string;
  title: string;
  model: string;
  systemPrompt?: string;
  createdAt: string;
}

export default function ChatRoomPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Template starter prompts
  const starterPrompts = [
    'What products are currently trending in your catalog?',
    'What is your return and exchange policy?',
    'Can I schedule a live video call with a sales agent?',
    'Do you offer any discounts for first-time buyers?',
  ];

  useEffect(() => {
    if (sessionId) {
      fetchSessionDetails();
    }
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const fetchSessionDetails = async () => {
    try {
      const res = await aiChatApi.getSession(sessionId);
      if (res) {
        setSession({
          id: res.id,
          title: res.title,
          model: res.model,
          systemPrompt: res.systemPrompt,
          createdAt: res.createdAt,
        });
        setMessages(res.messages || []);
      }
    } catch {
      toast.error('Failed to load chat session details');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || isStreaming) return;

    // Local state updates
    const userMsg: ChatMessage = { role: 'USER', content: messageText };
    const assistantPlaceholder: ChatMessage = { role: 'ASSISTANT', content: '' };
    
    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setInputMessage('');
    setIsStreaming(true);

    try {
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') || '' : '';
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
      
      // Establish SSE EventSource stream
      const streamUrl = `${apiBaseUrl}/ai-chat/sessions/${sessionId}/stream?message=${encodeURIComponent(
        messageText,
      )}&tenantId=${tenantId}`;
      
      const eventSource = new EventSource(streamUrl);
      let accumulatedResponse = '';

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const token = parsed.token;
          if (token) {
            accumulatedResponse += token;
            setMessages((prev) => {
              const updated = [...prev];
              const lastIndex = updated.length - 1;
              if (lastIndex >= 0 && updated[lastIndex].role === 'ASSISTANT') {
                updated[lastIndex] = {
                  role: 'ASSISTANT',
                  content: accumulatedResponse,
                };
              }
              return updated;
            });
          }
        } catch (err) {
          console.error('Failed to parse SSE token chunk', err);
        }
      };

      eventSource.onerror = () => {
        // SSE completes or encounters error
        eventSource.close();
        setIsStreaming(false);
        // Sync final DB state to retrieve proper message IDs/timestamps
        fetchSessionDetails();
      };
    } catch (err: any) {
      toast.error('Failed to stream response from AI');
      setIsStreaming(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputMessage);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-h-[850px] rounded-2xl border border-border bg-card overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/ai-chat')}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-bold text-foreground flex items-center gap-2">
              {loading ? 'Loading chat session...' : session?.title}
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 font-mono px-2 py-0.5 rounded-full border border-cyan-500/20">
                {session?.model || 'gpt-4o'}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? 'Initializing LiteLLM proxy...' : `Session ID: ${session?.id}`}
            </p>
          </div>
        </div>

        <button
          onClick={fetchSessionDetails}
          disabled={loading || isStreaming}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
          title="Refresh History"
        >
          <RefreshCw className="w-4.5 h-4.5 animate-hover-spin" />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-background/20 scrollbar-custom">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="w-8 h-8 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
            <p className="text-xs text-muted-foreground">Loading message history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-full bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
              <Bot className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Welcome to AI Customer Support</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This chat session is bound to your store visitor context. Type a message below or click one of the suggested prompts to see how the streaming gateway responds.
              </p>
            </div>

            {/* Suggested prompts list */}
            <div className="grid grid-cols-1 gap-2.5 w-full pt-4">
              {starterPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleSendMessage(prompt)}
                  className="flex items-center gap-2 p-3 text-left text-xs rounded-xl border border-border bg-card/60 hover:border-cyan-500/40 hover:bg-cyan-500/5 text-foreground transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* System prompt notification */}
            {session?.systemPrompt && (
              <div className="flex gap-2.5 p-3.5 rounded-xl bg-zinc-800/20 border border-zinc-700/30 text-xs text-muted-foreground">
                <AlertCircle className="w-4 h-4 text-cyan-500 shrink-0" />
                <span>
                  <strong className="text-foreground">System Directive:</strong> {session.systemPrompt}
                </span>
              </div>
            )}

            {/* Chat Bubble List */}
            {messages.map((msg, index) => {
              const isUser = msg.role === 'USER';
              return (
                <div
                  key={index}
                  className={`flex gap-3 max-w-[85%] ${
                    isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-8.5 h-8.5 rounded-full shrink-0 flex items-center justify-center ${
                    isUser ? 'bg-violet-600 text-white' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  }`}>
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  {/* Message box */}
                  <div className="space-y-1">
                    <div className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? 'bg-violet-600 text-white rounded-tr-none'
                        : 'bg-card border border-border rounded-tl-none text-foreground'
                    }`}>
                      {msg.content ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="flex gap-1.5 py-1.5 items-center justify-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Typing status */}
            {isStreaming && messages[messages.length - 1]?.content && (
              <div className="text-[10px] text-cyan-400 animate-pulse ml-12">
                AI Assistant is streaming response tokens...
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Chat Input form */}
      <div className="p-4 border-t border-border bg-muted/10">
        <form onSubmit={handleFormSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={loading || isStreaming}
            placeholder={
              isStreaming
                ? 'Please wait for AI response to complete...'
                : 'Ask AI support a question (e.g. return policy, trending products)...'
            }
            className="flex-1 px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || isStreaming || !inputMessage.trim()}
            className="px-5 rounded-xl text-white font-semibold flex items-center justify-center gradient-primary hover:opacity-95 disabled:opacity-50 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

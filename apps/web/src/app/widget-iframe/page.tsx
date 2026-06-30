'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  MessageSquare,
  PhoneCall,
  Play,
  HelpCircle,
  Video,
  X,
  Send,
  ExternalLink,
  Bot,
  User,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  widgetApi,
  aiChatApi,
  videoCallApi,
  videoFaqApi,
  shoppableVideoApi,
  analyticsApi,
} from '@/lib/api-client';
import { getSocket } from '@/lib/socket';

interface Message {
  role: 'USER' | 'ASSISTANT';
  content: string;
}

function WidgetIframeInner() {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenantId');
  const fingerprint = searchParams.get('fingerprint') || 'widget_anonymous';

  // Helper to send events to analytics API
  const trackIframeEvent = async (type: string, metadata: any = {}, visitorInfo: any = {}) => {
    if (!tenantId) return;
    try {
      await analyticsApi.trackEvent({
        fingerprint,
        type,
        page: window.location.href,
        referrer: typeof document !== 'undefined' ? document.referrer || '' : '',
        metadata,
        visitorInfo: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          ...visitorInfo
        },
        tenantId
      });
    } catch (err) {
      console.error('[Iframe Analytics] Failed to log event', err);
    }
  };

  // Widget settings
  const [config, setConfig] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'call' | 'videos' | 'faq'>('chat');
  const [loading, setLoading] = useState(true);

  // AI Chat state
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Video Call state
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [callStatus, setCallStatus] = useState<string | null>(null); // 'waiting' | 'in_progress' | null
  const [callRoomName, setCallRoomName] = useState<string | null>(null);

  // Shoppable Videos state
  const [videos, setVideos] = useState<any[]>([]);
  const [activeVideo, setActiveVideo] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);

  // Video FAQ state
  const [faqs, setFaqs] = useState<any[]>([]);
  const [activeFaqVideo, setActiveFaqVideo] = useState<string | null>(null);

  // Fetch initial config and data
  useEffect(() => {
    if (!tenantId) return;

    // Store tenantId in localStorage for apiClient to use as X-Tenant-ID header
    localStorage.setItem('tenantId', tenantId);

    const loadData = async () => {
      try {
        // 1. Fetch widget branding config
        const widgetConfig = await widgetApi.getConfig(tenantId);
        setConfig(widgetConfig);
        
        // Auto navigate to first enabled tab
        if (widgetConfig) {
          if (widgetConfig.enableChat) setActiveTab('chat');
          else if (widgetConfig.enableVideoCall) setActiveTab('call');
          else if (widgetConfig.enableShoppable) setActiveTab('videos');
          else if (widgetConfig.enableFaq) setActiveTab('faq');
        }

        // 2. Fetch shoppable videos
        const vidsRes = await shoppableVideoApi.list(10, 1);
        setVideos(vidsRes.data || []);

        // 3. Fetch Video FAQs
        const faqsRes = await videoFaqApi.list();
        setFaqs(faqsRes || []);
      } catch (err) {
        console.error('Failed to load widget config', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [tenantId]);

  // Load chat session if any
  useEffect(() => {
    if (chatSessionId) {
      aiChatApi.getSession(chatSessionId).then((res) => {
        if (res && res.messages) {
          setMessages(res.messages.map((m: any) => ({
            role: m.role,
            content: m.content,
          })));
        }
      });
    }
  }, [chatSessionId]);

  // Chat scroll anchor
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Hotspot tracking
  const handleTimeUpdate = () => {
    if (videoPlayerRef.current) {
      setCurrentTime(videoPlayerRef.current.currentTime);
    }
  };

  const handleCloseWidget = () => {
    if (typeof window !== 'undefined') {
      window.parent.postMessage({ type: 'CLOSE_WIDGET' }, '*');
    }
  };

  // Chat handles
  const handleStartChat = async () => {
    try {
      const res = await aiChatApi.createSession({ title: 'Visitor Support Chat' });
      setChatSessionId(res.id);
      setMessages([{ role: 'ASSISTANT', content: 'Hello! I am your AI sales assistant. How can I help you find products or resolve issues today?' }]);
      trackIframeEvent('CHAT_START', { sessionId: res.id });
    } catch {
      toast.error('Failed to initialize support chat');
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isStreaming || !chatSessionId) return;

    const userText = chatInput;
    setChatInput('');
    setMessages((prev) => [...prev, { role: 'USER', content: userText }, { role: 'ASSISTANT', content: '' }]);
    setIsStreaming(true);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
      const streamUrl = `${apiBaseUrl}/ai-chat/sessions/${chatSessionId}/stream?message=${encodeURIComponent(
        userText,
      )}&tenantId=${tenantId}`;

      const eventSource = new EventSource(streamUrl);
      let fullText = '';

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.token) {
            fullText += data.token;
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === 'ASSISTANT') {
                last.content = fullText;
              }
              return updated;
            });
          }
        } catch (err) {
          console.error(err);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setIsStreaming(false);
      };
    } catch {
      setIsStreaming(false);
    }
  };

  // Video call request handles
  const handleStartCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName) return;

    try {
      const res = await videoCallApi.create(
        {
          visitorName,
          visitorEmail: visitorEmail || undefined,
        },
        tenantId || undefined,
      );

      const socket = getSocket('/video', { tenantId: tenantId || undefined });
      socket.connect();
      socket.once('connect', () => {
        socket.emit('call:request', { callId: res.id });
      });

      setCallStatus('waiting');
      setCallRoomName(res.roomName);
      toast.success('Video call requested. Connecting with an available agent...');
      trackIframeEvent('VIDEO_CALL_REQUEST', { callId: res.id }, {
        name: visitorName,
        email: visitorEmail || undefined
      });
    } catch {
      toast.error('Failed to launch video call request');
    }
  };

  const handleSelectVideo = (vid: any) => {
    setActiveVideo(vid);
    trackIframeEvent('VIDEO_WATCH', { videoId: vid.id, title: vid.title });
  };

  const handleHotspotClick = (hs: any) => {
    trackIframeEvent('PRODUCT_CLICK', {
      hotspotId: hs.id,
      productName: hs.productName,
      productUrl: hs.productUrl,
      price: hs.price,
      videoId: activeVideo?.id
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!tenantId || !config) {
    return (
      <div className="flex h-screen items-center justify-center p-6 text-center bg-zinc-950 text-zinc-400 text-sm">
        Widget configuration error. Invalid or missing Tenant Key.
      </div>
    );
  }

  const primaryColor = config.primaryColor || '#6366f1';

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 select-none overflow-hidden font-sans">
      {/* Widget Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold truncate max-w-[180px]">
              {config.greeting.length > 28 ? config.greeting.substring(0, 28) + '...' : config.greeting}
            </h4>
            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AI Support Online
            </span>
          </div>
        </div>

        <button
          onClick={handleCloseWidget}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto p-4 bg-zinc-950 relative">
        {/* Chat tab */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full justify-between">
            {!chatSessionId ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4 space-y-6">
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Bot className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h5 className="font-bold text-sm">AI Support Chatbot</h5>
                  <p className="text-xs text-zinc-500 mt-1.5 max-w-[240px] leading-relaxed">
                    Have questions? Chat with our AI support to get instant answers about items, pricing, or shipping.
                  </p>
                </div>
                <button
                  onClick={handleStartChat}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white transition-all shadow-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  Start Chat Support
                </button>
              </div>
            ) : (
              <div className="flex flex-col h-full justify-between gap-4">
                {/* Messages grid */}
                <div className="flex-1 overflow-y-auto space-y-4 max-h-[380px] pr-1">
                  {messages.map((msg, index) => {
                    const isUser = msg.role === 'USER';
                    return (
                      <div
                        key={index}
                        className={`flex gap-2.5 max-w-[85%] ${
                          isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs ${
                          isUser ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-indigo-400 border border-zinc-700/50'
                        }`}>
                          {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                        </div>
                        <div className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                          isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-none'
                        }`}>
                          {msg.content ? (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          ) : (
                            <div className="flex gap-1.5 py-1.5 items-center justify-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Input bar */}
                <form onSubmit={handleSendChatMessage} className="flex gap-1.5 pt-2 border-t border-zinc-900">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={isStreaming}
                    placeholder="Ask a question..."
                    className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs focus:outline-none focus:border-zinc-700 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isStreaming || !chatInput.trim()}
                    className="p-2 rounded-lg text-white flex items-center justify-center transition-all disabled:opacity-50"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Send className="w-4.5 h-4.5" />
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Video Call tab */}
        {activeTab === 'call' && (
          <div className="flex flex-col h-full justify-center">
            {callStatus === null ? (
              <form onSubmit={handleStartCall} className="space-y-4 max-w-[280px] mx-auto text-center">
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-2">
                  <PhoneCall className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h5 className="font-bold text-sm">Live Call with Agent</h5>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Connect directly with a sales agent in an interactive WebRTC video session.
                  </p>
                </div>

                <div className="space-y-2 text-left">
                  <input
                    type="text"
                    required
                    placeholder="Your Name *"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                  />
                  <input
                    type="email"
                    placeholder="Your Email (Optional)"
                    value={visitorEmail}
                    onChange={(e) => setVisitorEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-white shadow-lg transition-all"
                  style={{ backgroundColor: primaryColor }}
                >
                  Start Video Call Request
                </button>
              </form>
            ) : (
              <div className="text-center space-y-4 p-6">
                <div className="w-10 h-10 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin mx-auto" />
                <h5 className="font-bold text-sm text-indigo-400">Queueing Video Call</h5>
                <p className="text-xs text-zinc-500 max-w-[220px] mx-auto leading-relaxed">
                  Call Room: <span className="font-mono text-[10px] text-zinc-300">{callRoomName}</span>. Waiting for an available agent to pick up...
                </p>
                <button
                  onClick={() => setCallStatus(null)}
                  className="px-4 py-2 border border-zinc-800 hover:bg-zinc-900 text-zinc-400 text-xs font-semibold rounded-lg"
                >
                  Cancel Request
                </button>
              </div>
            )}
          </div>
        )}

        {/* Shoppable Videos tab */}
        {activeTab === 'videos' && (
          <div className="h-full">
            {!activeVideo ? (
              videos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 text-xs gap-2">
                  <Video className="w-8 h-8 text-zinc-700" />
                  No shoppable videos available.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-h-[380px] overflow-y-auto">
                  {videos.map((vid) => (
                    <div
                      key={vid.id}
                      onClick={() => handleSelectVideo(vid)}
                      className="group bg-zinc-900 rounded-xl border border-zinc-800/80 overflow-hidden cursor-pointer hover:border-zinc-700 transition-all"
                    >
                      <div className="aspect-video bg-black relative flex items-center justify-center">
                        {vid.thumbnailUrl ? (
                          <img src={vid.thumbnailUrl} alt={vid.title} className="w-full h-full object-cover" />
                        ) : (
                          <Video className="w-8 h-8 text-zinc-700" />
                        )}
                        <span className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-5 h-5 fill-white text-white" />
                        </span>
                      </div>
                      <div className="p-2.5">
                        <h6 className="text-[11px] font-bold truncate">{vid.title}</h6>
                        <span className="text-[9px] text-zinc-500">{vid.views} views</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="flex flex-col h-full gap-3">
                <button
                  onClick={() => setActiveVideo(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 self-start"
                >
                  <ArrowLeft className="w-4.5 h-4.5" /> Back to Videos
                </button>

                {/* Interactive video viewport */}
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center">
                  {activeVideo.videoUrl ? (
                    <video
                      ref={videoPlayerRef}
                      src={activeVideo.videoUrl}
                      controls
                      autoPlay
                      onTimeUpdate={handleTimeUpdate}
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.error?.code) {
                          console.warn('Widget video error:', target.error.message);
                        }
                      }}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-zinc-500">No video source available</div>
                  )}

                  {/* Hotspots layer */}
                  {activeVideo.hotspots?.map((hs: any) => {
                    const active = currentTime >= hs.startTime && currentTime <= hs.endTime;
                    if (!active) return null;
                    return (
                      <a
                        key={hs.id}
                        href={hs.productUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => handleHotspotClick(hs)}
                        className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-indigo-600/90 text-white flex items-center justify-center shadow-lg hover:scale-125 transition-transform group/tag"
                        style={{
                          left: `${hs.posX || 50}%`,
                          top: `${hs.posY || 50}%`,
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5 fill-white" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-950 text-[10px] text-white px-2 py-1 rounded border border-zinc-800 whitespace-nowrap opacity-0 group-hover/tag:opacity-100 transition-opacity flex items-center gap-1 shadow-xl">
                          {hs.productName} • ${hs.price || '0.00'}
                          <ExternalLink className="w-3 h-3 text-indigo-400" />
                        </span>
                      </a>
                    );
                  })}
                </div>
                <div className="space-y-1 p-1">
                  <h6 className="font-bold text-xs">{activeVideo.title}</h6>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">{activeVideo.description || 'No description.'}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Video FAQ tab */}
        {activeTab === 'faq' && (
          <div className="h-full">
            {activeFaqVideo ? (
              <div className="flex flex-col h-full gap-3">
                <button
                  onClick={() => setActiveFaqVideo(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 self-start"
                >
                  <ArrowLeft className="w-4.5 h-4.5" /> Back to FAQ List
                </button>
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center">
                  {activeFaqVideo ? (
                    <video
                      src={activeFaqVideo}
                      controls
                      autoPlay
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.error?.code) {
                          console.warn('Widget FAQ video error:', target.error.message);
                        }
                      }}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-zinc-500">No FAQ video available</div>
                  )}
                </div>
              </div>
            ) : faqs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 text-xs gap-2">
                <HelpCircle className="w-8 h-8 text-zinc-700" />
                No FAQ questions available.
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {faqs.map((faq) => (
                  <div key={faq.id} className="space-y-2">
                    <h6 className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider px-1">
                      {faq.title}
                    </h6>
                    <div className="space-y-1.5">
                      {faq.items.map((item: any) => (
                        <div
                          key={item.id}
                          onClick={() => setActiveFaqVideo(item.videoUrl)}
                          className="flex items-center justify-between p-3 rounded-xl border border-zinc-900 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-zinc-800 cursor-pointer transition-all"
                        >
                          <span className="text-xs font-medium text-zinc-200 line-clamp-1">
                            {item.question}
                          </span>
                          <Play className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400/20" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Panel Footer Navigation tabs */}
      <div className="grid grid-cols-4 p-2 bg-zinc-900 border-t border-zinc-800">
        {config.enableChat && (
          <button
            onClick={() => {
              setActiveTab('chat');
              setActiveVideo(null);
              setActiveFaqVideo(null);
            }}
            className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-all ${
              activeTab === 'chat' ? 'text-indigo-400 bg-indigo-500/5' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[9px] font-semibold">Chat</span>
          </button>
        )}

        {config.enableVideoCall && (
          <button
            onClick={() => {
              setActiveTab('call');
              setActiveVideo(null);
              setActiveFaqVideo(null);
            }}
            className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-all ${
              activeTab === 'call' ? 'text-indigo-400 bg-indigo-500/5' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <PhoneCall className="w-5 h-5" />
            <span className="text-[9px] font-semibold">Call</span>
          </button>
        )}

        {config.enableShoppable && (
          <button
            onClick={() => {
              setActiveTab('videos');
              setActiveFaqVideo(null);
            }}
            className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-all ${
              activeTab === 'videos' ? 'text-indigo-400 bg-indigo-500/5' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Video className="w-5 h-5" />
            <span className="text-[9px] font-semibold">Videos</span>
          </button>
        )}

        {config.enableFaq && (
          <button
            onClick={() => {
              setActiveTab('faq');
              setActiveVideo(null);
            }}
            className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-all ${
              activeTab === 'faq' ? 'text-indigo-400 bg-indigo-500/5' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <HelpCircle className="w-5 h-5" />
            <span className="text-[9px] font-semibold">FAQs</span>
          </button>
        )}
      </div>
    </div>
  );
}

function ArrowLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" x2="5" y1="12" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export default function WidgetIframePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
      </div>
    }>
      <WidgetIframeInner />
    </Suspense>
  );
}

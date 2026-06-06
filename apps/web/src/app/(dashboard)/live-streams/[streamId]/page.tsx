'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ParticipantTile,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import {
  Tv,
  Send,
  Users,
  Tag,
  DollarSign,
  Plus,
  Trash2,
  Volume2,
  FileText,
  AlertCircle,
  Eye,
  Megaphone,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { liveStreamApi } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { Socket } from 'socket.io-client';

interface StreamProduct {
  id: string;
  productName: string;
  productUrl: string;
  productImage?: string | null;
  price?: number | null;
  currency: string;
  featuredAt?: string | null;
}

interface ChatMessage {
  id: string;
  senderName: string;
  message: string;
  createdAt: string;
}

export default function LiveStreamRoomPage() {
  const params = useParams();
  const router = useRouter();
  const streamId = params.streamId as string;

  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [identity, setIdentity] = useState('');
  const [userName, setUserName] = useState('');

  // Socket state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [viewerCount, setViewerCount] = useState(1);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [typedMessage, setTypedMessage] = useState('');

  // Stream data state
  const [streamTitle, setStreamTitle] = useState('');
  const [products, setProducts] = useState<StreamProduct[]>([]);
  const [featuredProduct, setFeaturedProduct] = useState<StreamProduct | null>(null);

  // Add Product form state
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdUrl, setNewProdUrl] = useState('');
  const [newProdImage, setNewProdImage] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (streamId) {
      initializeRoom();
    }
  }, [streamId]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const initializeRoom = async () => {
    try {
      // Get user details
      const profileStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      let participantName = 'Guest Viewer';
      if (profileStr) {
        try {
          const profile = JSON.parse(profileStr);
          participantName = profile.name || 'Agent';
        } catch {}
      }
      setUserName(participantName);

      // Join stream
      const res = await liveStreamApi.join(streamId, participantName);
      setToken(res.token);
      setRoomName(res.roomName);
      setIsHost(res.isHost);
      setIdentity(res.identity);

      // Fetch stream details & products
      const details = await liveStreamApi.get(streamId);
      setStreamTitle(details.title);
      setProducts(details.products || []);
      
      const activeFeatured = details.products?.find((p: any) => p.featuredAt);
      if (activeFeatured) {
        setFeaturedProduct(activeFeatured);
      }

      // Connect Socket
      const s = getSocket('/stream');
      setSocket(s);

      s.connect();

      s.on('connect', () => {
        s.emit('stream:join', { streamId, name: participantName });
      });

      s.on('stream:viewer-count', (data: { count: number }) => {
        setViewerCount(data.count);
      });

      s.on('stream:chat-message', (data: ChatMessage) => {
        setChatMessages((prev) => [...prev, data]);
      });

      s.on('stream:product-featured', (data: any) => {
        setFeaturedProduct(data);
        toast.info(`Featured Product: ${data.productName}! Check it out!`);
      });

    } catch (err: any) {
      toast.error('Failed to connect to live stream');
      router.push('/live-streams');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !typedMessage.trim()) return;

    socket.emit('stream:chat-send', {
      message: typedMessage.trim(),
      senderName: userName,
    });

    setTypedMessage('');
  };

  const handleEndStream = async () => {
    try {
      await liveStreamApi.end(streamId);
      toast.success('Live stream ended');
    } catch (err: any) {
      console.warn('Failed to end stream room', err.message);
    } finally {
      router.push('/live-streams');
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdUrl) return;

    try {
      const priceVal = newProdPrice ? parseFloat(newProdPrice) : undefined;
      const product = await liveStreamApi.addProduct(streamId, {
        productName: newProdName,
        productUrl: newProdUrl,
        productImage: newProdImage || undefined,
        price: priceVal,
      });

      setProducts((prev) => [...prev, product]);
      toast.success('Shoppable product added');
      setShowAddProduct(false);
      setNewProdName('');
      setNewProdUrl('');
      setNewProdImage('');
      setNewProdPrice('');
    } catch (err: any) {
      toast.error('Failed to add product');
    }
  };

  const handleFeatureProduct = (productId: string) => {
    if (!socket) return;
    const tenantId = localStorage.getItem('tenantId') || '';
    socket.emit('stream:feature-product', {
      streamId,
      productId,
      tenantId,
    });
    toast.success('Product featured to viewers!');
  };

  const handleRemoveProduct = async (productId: string) => {
    try {
      await liveStreamApi.removeProduct(streamId, productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      if (featuredProduct?.id === productId) {
        setFeaturedProduct(null);
      }
      toast.success('Product removed');
    } catch (err: any) {
      toast.error('Failed to remove product');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Connecting to Live Streaming SFU...</p>
      </div>
    );
  }

  if (!token || !roomName) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <p className="text-rose-500 font-semibold">Could not establish stream session.</p>
        <button
          onClick={() => router.push('/live-streams')}
          className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm text-foreground font-semibold"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-[calc(100vh-140px)] overflow-hidden">
      {/* Media & Viewer Overlay Column */}
      <div className="flex-1 flex flex-col rounded-2xl border border-border bg-zinc-950 overflow-hidden relative group">
        
        {/* Stream Header */}
        <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-border/40 pointer-events-auto">
            <Tv className="w-4 h-4 text-rose-500 animate-pulse" />
            <span className="font-bold text-sm text-white max-w-[200px] truncate">{streamTitle}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3.5 py-2 rounded-xl border border-border/40 text-xs font-semibold text-white pointer-events-auto">
              <Eye className="w-4 h-4 text-emerald-500" />
              <span>{viewerCount} Watching</span>
            </div>

            {isHost && (
              <button
                onClick={handleEndStream}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/25 pointer-events-auto transition-all"
              >
                End Stream
              </button>
            )}
          </div>
        </div>

        {/* LiveKit Player */}
        <div className="flex-1 flex flex-col">
          <LiveKitRoom
            video={isHost}
            audio={isHost}
            token={token}
            serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || 'ws://localhost:7880'}
            data-lk-theme="default"
            onDisconnected={() => router.push('/live-streams')}
            className="flex-1 flex flex-col justify-center"
          >
            {isHost ? (
              <VideoConference />
            ) : (
              <StreamViewerLayout />
            )}
            <RoomAudioRenderer />
          </LiveKitRoom>
        </div>

        {/* Floating Featured Product Overlay (For Viewer View) */}
        {!isHost && featuredProduct && (
          <div className="absolute bottom-6 right-6 z-40 w-80 p-4 rounded-xl border border-violet-500/30 bg-black/80 backdrop-blur-md shadow-2xl flex gap-3 animate-fade-in">
            {featuredProduct.productImage && (
              <img
                src={featuredProduct.productImage}
                alt={featuredProduct.productName}
                className="w-16 h-16 rounded-lg object-cover border border-border"
              />
            )}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-violet-400 flex items-center gap-1">
                  <Megaphone className="w-3.5 h-3.5 animate-bounce" /> Featured Product
                </h4>
                <div className="text-sm font-semibold text-white truncate mt-1">{featuredProduct.productName}</div>
                {featuredProduct.price && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {featuredProduct.price} {featuredProduct.currency}
                  </div>
                )}
              </div>
              <a
                href={featuredProduct.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-center text-xs font-bold text-white gradient-primary py-1.5 rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-1"
              >
                Buy Now
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar - Interactive Chat & Shoppable Panels */}
      <div className="w-full xl:w-96 flex flex-col md:flex-row xl:flex-col gap-6 xl:h-full h-[350px]">
        
        {/* Chat Feed */}
        <div className="flex-1 rounded-2xl border border-border bg-card p-4 flex flex-col justify-between overflow-hidden">
          <div className="pb-3 border-b border-border flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-violet-500" />
            <h3 className="font-bold text-sm text-foreground">Live Room Chat</h3>
          </div>

          <div className="flex-1 overflow-y-auto my-3 space-y-3 pr-1 text-xs">
            {chatMessages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Welcome to the stream! Say hello in chat.</div>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className="space-y-0.5">
                  <span className="font-bold text-violet-400 mr-1.5">{msg.senderName}</span>
                  <span className="text-foreground">{msg.message}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              placeholder="Send message..."
              value={typedMessage}
              onChange={(e) => setTypedMessage(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-violet-500"
            />
            <button
              type="submit"
              className="p-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Shoppable Products Manager (Host specific) or Shoppable list (Viewer specific) */}
        <div className="flex-1 rounded-2xl border border-border bg-card p-4 flex flex-col overflow-hidden">
          <div className="pb-3 border-b border-border flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-violet-500" />
              <h3 className="font-bold text-sm text-foreground">Shoppable Showcase</h3>
            </span>
            {isHost && (
              <button
                onClick={() => setShowAddProduct(!showAddProduct)}
                className="p-1 rounded-lg hover:bg-muted text-violet-500"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {showAddProduct ? (
            <form onSubmit={handleAddProduct} className="flex-1 overflow-y-auto my-3 space-y-3 pr-1 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Vintage Leather Jacket"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">Checkout URL *</label>
                <input
                  type="url"
                  required
                  placeholder="https://yourstore.com/jacket"
                  value={newProdUrl}
                  onChange={(e) => setNewProdUrl(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="99.99"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Image URL</label>
                  <input
                    type="url"
                    placeholder="Image link"
                    value={newProdImage}
                    onChange={(e) => setNewProdImage(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddProduct(false)}
                  className="flex-1 py-1.5 border border-border rounded-lg text-foreground hover:bg-muted font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-semibold"
                >
                  Save Product
                </button>
              </div>
            </form>
          ) : (
            <div className="flex-1 overflow-y-auto my-3 space-y-2 pr-1">
              {products.length === 0 ? (
                <div className="text-center py-12 text-xs text-muted-foreground">No shoppable items cataloged.</div>
              ) : (
                products.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-2 rounded-xl border border-border bg-background flex justify-between items-center gap-3 text-xs"
                  >
                    {prod.productImage && (
                      <img
                        src={prod.productImage}
                        alt={prod.productName}
                        className="w-10 h-10 rounded-lg object-cover border border-border"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-foreground truncate">{prod.productName}</div>
                      {prod.price && (
                        <div className="text-muted-foreground text-[10px] mt-0.5">
                          {prod.price} {prod.currency}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1.5">
                      {isHost ? (
                        <>
                          <button
                            onClick={() => handleFeatureProduct(prod.id)}
                            className="px-2.5 py-1 rounded bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold transition-all"
                          >
                            Feature
                          </button>
                          <button
                            onClick={() => handleRemoveProduct(prod.id)}
                            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-rose-500 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <a
                          href={prod.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 rounded bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold transition-all flex items-center gap-0.5"
                        >
                          Buy <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Viewer specific Media stream renderer
function StreamViewerLayout() {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);

  // Find host stream tracks
  const videoTrack = tracks.find((t) => t.source === Track.Source.Camera || t.source === Track.Source.ScreenShare);

  if (!videoTrack) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-center space-y-4">
        <div className="w-10 h-10 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
        <div className="space-y-1">
          <h4 className="font-bold text-white text-sm">Waiting for Broadcaster</h4>
          <p className="text-xs text-muted-foreground">The stream room is ready. Streaming will begin once host goes live.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center h-full max-h-[80vh] overflow-hidden">
      <ParticipantTile trackRef={videoTrack} className="w-full h-full object-contain" />
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Play,
  Pause,
  Plus,
  Trash2,
  Tag,
  Save,
  Clock,
  ArrowLeft,
  X,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { shoppableVideoApi } from '@/lib/api-client';

interface Hotspot {
  id: string;
  productName: string;
  productUrl: string;
  productImage?: string | null;
  price?: number | null;
  currency: string;
  startTime: number;
  endTime: number;
  posX?: number | null;
  posY?: number | null;
}

interface VideoAsset {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  status: string;
  hotspots: Hotspot[];
}

export default function VideoHotspotEditorPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.videoId as string;

  const [video, setVideo] = useState<VideoAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Hotspot form/modal state
  const [showModal, setShowModal] = useState(false);
  const [clickX, setClickX] = useState(0);
  const [clickY, setClickY] = useState(0);
  const [prodName, setProdName] = useState('');
  const [prodUrl, setProdUrl] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(5);
  const [saving, setSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    if (videoId) {
      fetchVideoDetails();
    }
  }, [videoId]);

  const fetchVideoDetails = async () => {
    try {
      const data = await shoppableVideoApi.get(videoId);
      setVideo(data);
    } catch {
      toast.error('Failed to load video details');
      router.push('/shoppable-videos');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handlePlayToggle = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {
          // Autoplay blocked by browser — just update state
          setIsPlaying(false);
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoError = () => {
    setVideoError(true);
  };

  const handleVideoCanPlay = () => {
    setVideoError(false);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !containerRef.current) return;

    // Pause video when editor opens
    videoRef.current.pause();
    setIsPlaying(false);

    // Get click bounds coordinates in percentages
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setClickX(x);
    setClickY(y);
    setStartTime(Math.round(videoRef.current.currentTime));
    setEndTime(Math.round(Math.min(videoRef.current.currentTime + 5, duration)));
    setShowModal(true);
  };

  const handleSaveHotspot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName || !prodUrl) return;

    setSaving(true);
    try {
      await shoppableVideoApi.addHotspot(videoId, {
        productName: prodName,
        productUrl: prodUrl,
        productImage: prodImage || undefined,
        price: prodPrice ? parseFloat(prodPrice) : undefined,
        startTime,
        endTime,
        posX: Math.round(clickX),
        posY: Math.round(clickY),
      });

      toast.success('Shoppable hotspot created successfully');
      setShowModal(false);
      
      // Reset form
      setProdName('');
      setProdUrl('');
      setProdPrice('');
      setProdImage('');

      fetchVideoDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save hotspot');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHotspot = async (hotspotId: string) => {
    try {
      await shoppableVideoApi.deleteHotspot(videoId, hotspotId);
      toast.success('Hotspot deleted');
      fetchVideoDetails();
    } catch {
      toast.error('Failed to delete hotspot');
    }
  };

  // Check if a hotspot should render at current playback timestamp
  const activeHotspots = video?.hotspots?.filter(
    (h) => currentTime >= h.startTime && currentTime <= h.endTime,
  ) || [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Loading timeline canvas editor...</p>
      </div>
    );
  }

  if (!video) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/shoppable-videos')}
          className="p-2 border border-border hover:bg-muted rounded-xl text-muted-foreground transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Interactive Hotspot Editor</h1>
          <p className="text-muted-foreground mt-0.5">Title: {video.title}</p>
        </div>
      </div>

      {/* Editor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-220px)] overflow-hidden">
        {/* Canvas & Video column */}
        <div className="lg:col-span-2 flex flex-col justify-between rounded-2xl border border-border bg-zinc-950 p-4 relative group">
          {/* Video Container */}
          <div
            ref={containerRef}
            onClick={handleCanvasClick}
            className="flex-1 w-full max-h-[75vh] flex justify-center items-center relative overflow-hidden cursor-crosshair"
          >
            {videoError ? (
              <div className="flex flex-col items-center justify-center gap-3 text-zinc-500 py-10">
                <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="text-sm font-medium">Video failed to load. The file may have moved or the URL has changed.</span>
                <button onClick={() => { setVideoError(false); if (videoRef.current) { videoRef.current.load(); } }} className="px-4 py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg">
                  Retry
                </button>
              </div>
            ) : (
              <video
                key={video.videoUrl}
                ref={videoRef}
                src={video.videoUrl}
                crossOrigin="anonymous"
                preload="metadata"
                playsInline
                onTimeUpdate={handleVideoTimeUpdate}
                onLoadedMetadata={handleVideoLoadedMetadata}
                onError={handleVideoError}
                onCanPlay={handleVideoCanPlay}
                className="max-w-full max-h-full rounded-lg object-contain pointer-events-none"
              />
            )}

            {/* Render Absolute Hotspot Overlays */}
            {activeHotspots.map((spot) => (
              <div
                key={spot.id}
                style={{
                  position: 'absolute',
                  left: `${spot.posX}%`,
                  top: `${spot.posY}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="z-30 pointer-events-auto group/dot"
                onClick={(e) => {
                  e.stopPropagation(); // Avoid triggering canvas click
                  toast.info(`Product: ${spot.productName}`);
                }}
              >
                {/* Hotspot Ring Indicator */}
                <div className="w-5 h-5 rounded-full border-2 border-white bg-violet-600 animate-ping absolute" />
                <div className="w-5 h-5 rounded-full border-2 border-white bg-violet-600 relative flex items-center justify-center shadow-lg cursor-pointer">
                  <Tag className="w-2.5 h-2.5 text-white" />
                </div>

                {/* Hover Tooltip card */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover/dot:opacity-100 transition-opacity pointer-events-none w-48 p-3 bg-black/80 backdrop-blur-md border border-border rounded-xl shadow-xl space-y-2 text-left">
                  {spot.productImage && (
                    <img
                      src={spot.productImage}
                      alt={spot.productName}
                      className="w-full h-20 object-cover rounded-lg"
                    />
                  )}
                  <div className="text-[11px] font-bold text-white truncate">{spot.productName}</div>
                  {spot.price && (
                    <div className="text-[10px] text-violet-400 font-bold">
                      {spot.price} {spot.currency}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Custom controls bar */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-zinc-800">
            <button
              onClick={handlePlayToggle}
              className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>
            
            {/* Progress bar */}
            <div className="flex-1 flex items-center gap-3 text-xs text-zinc-400 font-medium">
              <span>{Math.round(currentTime)}s</span>
              <input
                type="range"
                min={0}
                max={duration || 1}
                value={currentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCurrentTime(val);
                  if (videoRef.current) videoRef.current.currentTime = val;
                }}
                className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-violet-500"
              />
              <span>{Math.round(duration)}s</span>
            </div>
          </div>
        </div>

        {/* Sidebar lists hotspots */}
        <div className="p-6 rounded-2xl bg-card border border-border flex flex-col h-full overflow-hidden">
          <div className="pb-4 border-b border-border">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              <Tag className="w-5 h-5 text-violet-500" />
              Tagged Hotspots ({video.hotspots?.length || 0})
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Click anywhere on the video screen to tag coordinates and overlay a product link.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto my-4 space-y-3 pr-1">
            {video.hotspots?.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">No hotspots configured. Pause the video and click a spot to tag.</div>
            ) : (
              video.hotspots.map((spot) => (
                <div
                  key={spot.id}
                  className="p-3.5 rounded-xl border border-border bg-background/50 hover:bg-background flex justify-between items-center gap-4 text-xs"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="font-bold text-foreground truncate flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                      {spot.productName}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {spot.startTime}s - {spot.endTime}s
                      </span>
                      <span>Pos: X:{spot.posX}%, Y:{spot.posY}%</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteHotspot(spot.id)}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-rose-500 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Hotspot Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 bg-card border border-border rounded-2xl shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Tag className="w-5 h-5 text-violet-500" />
                Configure Hotspot Tag
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHotspot} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground p-3 rounded-xl border border-violet-500/10 bg-violet-500/5">
                <div>Position: X: {Math.round(clickX)}%, Y: {Math.round(clickY)}%</div>
                <div>Timeline Start: {startTime}s</div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Retro Leather Shoes"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Checkout URL *</label>
                <input
                  type="url"
                  required
                  placeholder="https://yourstore.com/shoes"
                  value={prodUrl}
                  onChange={(e) => setProdUrl(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="49.99"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Display End (seconds)</label>
                  <input
                    type="number"
                    required
                    min={startTime + 1}
                    max={duration || 1000}
                    value={endTime}
                    onChange={(e) => setEndTime(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Product Image URL (Optional)</label>
                <input
                  type="url"
                  placeholder="Image link"
                  value={prodImage}
                  onChange={(e) => setProdImage(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-border rounded-lg text-sm font-semibold hover:bg-muted text-foreground transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-lg text-white font-semibold text-sm gradient-primary hover:opacity-95 disabled:opacity-50 transition-all"
                >
                  {saving ? 'Creating...' : 'Save Tag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

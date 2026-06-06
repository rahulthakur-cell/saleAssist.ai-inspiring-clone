'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Tv,
  Plus,
  Calendar,
  Clock,
  ExternalLink,
  Trash2,
  Tag,
  MessageSquare,
  Activity,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { liveStreamApi } from '@/lib/api-client';

interface LiveStream {
  id: string;
  title: string;
  description?: string;
  status: string;
  scheduledAt?: string;
  isShoppable: boolean;
  peakViewers: number;
  totalViewers: number;
  roomName: string;
}

export default function LiveStreamsPage() {
  const router = useRouter();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [isShoppable, setIsShoppable] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchStreams();
  }, []);

  const fetchStreams = async () => {
    try {
      const res = await liveStreamApi.list(20, 1);
      setStreams(res.data || []);
    } catch (err: any) {
      toast.error('Failed to load live streams');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    setCreating(true);
    try {
      await liveStreamApi.create({
        title,
        description: description || undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        isShoppable,
      });

      toast.success('Live stream scheduled successfully!');
      setShowModal(false);
      setTitle('');
      setDescription('');
      setScheduledAt('');
      setIsShoppable(false);
      fetchStreams();
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule stream');
    } finally {
      setCreating(false);
    }
  };

  const handleLaunchStream = async (streamId: string) => {
    try {
      await liveStreamApi.start(streamId);
      router.push(`/live-streams/${streamId}`);
    } catch (err: any) {
      toast.error('Failed to start stream');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl bg-card border border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Live Streaming Campaigns</h1>
          <p className="text-muted-foreground mt-1">Host shoppable streaming events, showcase collections, and interact with viewers in real time.</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white gradient-primary hover:opacity-95 shadow-md shadow-violet-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Schedule Live Stream
        </button>
      </div>

      {/* Main content grid */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="w-8 h-8 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
        </div>
      ) : streams.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-500">
            <Tv className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No Streams Scheduled</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Schedule a shoppable live broadcast, add products, and invite your customers to shop directly from your video feed.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg shadow-lg shadow-violet-500/10 transition-all"
          >
            Create Your First Stream
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {streams.map((stream) => (
            <div
              key={stream.id}
              className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col justify-between"
            >
              {/* Card Thumbnail / Header */}
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      stream.status === 'LIVE'
                        ? 'bg-rose-500/15 text-rose-500 animate-pulse'
                        : stream.status === 'SCHEDULED'
                        ? 'bg-amber-500/10 text-amber-500'
                        : 'bg-zinc-500/10 text-zinc-400'
                    }`}
                  >
                    {stream.status}
                  </span>
                  {stream.isShoppable && (
                    <span className="flex items-center gap-1 text-xs text-violet-500 bg-violet-500/10 px-2 py-0.5 rounded-full font-semibold">
                      <Tag className="w-3.5 h-3.5" /> Shoppable
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-bold text-lg text-foreground line-clamp-1">{stream.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{stream.description || 'No description provided.'}</p>
                </div>

                {/* Details */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  {stream.scheduledAt && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-4 h-4 text-violet-500" />
                      <span>{new Date(stream.scheduledAt).toLocaleDateString()}</span>
                      <Clock className="w-4 h-4 text-violet-500 ml-2" />
                      <span>{new Date(stream.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}

                  {stream.status === 'ENDED' && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5" /> Peak: {stream.peakViewers}
                      </span>
                      <span>Total Viewers: {stream.totalViewers}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-6 pt-0 flex gap-2">
                {stream.status === 'LIVE' ? (
                  <button
                    onClick={() => router.push(`/live-streams/${stream.id}`)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all"
                  >
                    Join Stream Room
                  </button>
                ) : stream.status === 'SCHEDULED' ? (
                  <button
                    onClick={() => handleLaunchStream(stream.id)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all"
                  >
                    Go Live Now
                  </button>
                ) : (
                  <button
                    onClick={() => router.push(`/live-streams/${stream.id}`)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-border hover:bg-muted text-foreground text-xs font-bold transition-all"
                  >
                    View Recording
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 bg-card border border-border rounded-2xl shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Tv className="w-5 h-5 text-violet-500" />
                Schedule Shoppable Stream
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStream} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Broadcast Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Summer Collection Showcase"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <textarea
                  placeholder="Explain what products you will present or any promo codes available..."
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Scheduled Time</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="shoppable"
                  checked={isShoppable}
                  onChange={(e) => setIsShoppable(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-background text-violet-600 focus:ring-violet-500"
                />
                <label htmlFor="shoppable" className="text-sm font-medium text-foreground cursor-pointer select-none">
                  Enable Shoppable Product Overlays
                </label>
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
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-lg text-white font-semibold text-sm gradient-primary hover:opacity-95 disabled:opacity-50 transition-all"
                >
                  {creating ? 'Scheduling...' : 'Schedule Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

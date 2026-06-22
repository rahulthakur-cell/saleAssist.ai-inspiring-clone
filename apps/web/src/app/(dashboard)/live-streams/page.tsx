'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Tv,
  Plus,
  Calendar,
  Clock,
  ChevronRight,
  Play,
  Film,
  Trash2,
  Tag,
  Activity,
  X,
  Rocket,
  Zap,
  Eye,
  Users,
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
  recordingUrl?: string;
  createdAt: string;
}

type ModalType = 'schedule' | 'recorded' | null;

export default function LiveStreamsPage() {
  const router = useRouter();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Schedule form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [isShoppable, setIsShoppable] = useState(false);
  const [creating, setCreating] = useState(false);

  // Recorded stream form state
  const [recTitle, setRecTitle] = useState('');
  const [recDescription, setRecDescription] = useState('');
  const [recVideoUrl, setRecVideoUrl] = useState('');
  const [recScheduledAt, setRecScheduledAt] = useState('');

  // Quota state
  const [quota, setQuota] = useState<{ count: number; limit: number }>({ count: 0, limit: 25 });

  useEffect(() => {
    fetchStreams();
    fetchQuota();
  }, []);

  const fetchStreams = async () => {
    try {
      const res = await liveStreamApi.list(50, 1);
      setStreams(res.data || []);
    } catch (err: any) {
      const msg = err?.message || 'Failed to load live streams';
      toast.error(`Live Streams: ${msg}`);
      console.error('[LiveStreams] fetchStreams error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuota = async () => {
    try {
      const res = await liveStreamApi.getCount();
      setQuota(res);
    } catch (err: any) {
      console.error('[LiveStreams] fetchQuota error:', err);
      // Non-critical — don't show toast for quota errors
    }
  };

  const resetScheduleForm = () => {
    setTitle('');
    setDescription('');
    setScheduledAt('');
    setIsShoppable(false);
  };

  const resetRecordedForm = () => {
    setRecTitle('');
    setRecDescription('');
    setRecVideoUrl('');
    setRecScheduledAt('');
  };

  const handleScheduleStream = async (e: React.FormEvent) => {
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
      toast.success('Event scheduled successfully!');
      setModalType(null);
      resetScheduleForm();
      fetchStreams();
      fetchQuota();
    } catch (err: any) {
      const msg = err?.message || 'Failed to schedule event';
      toast.error(`Schedule Event: ${msg}`);
      console.error('[LiveStreams] handleScheduleStream error:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleInstantStream = async () => {
    setCreating(true);
    try {
      const now = new Date();
      const instantTitle = `Live Stream — ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const res = await liveStreamApi.create({
        title: instantTitle,
        isShoppable: false,
      });
      await liveStreamApi.start(res.id);
      toast.success('Going live now!');
      router.push(`/live-streams/${res.id}`);
    } catch (err: any) {
      const msg = err?.message || 'Failed to start instant stream';
      toast.error(`Instant Stream: ${msg}`);
      console.error('[LiveStreams] handleInstantStream error:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleRecordedStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recTitle || !recVideoUrl) return;
    setCreating(true);
    try {
      await liveStreamApi.create({
        title: recTitle,
        description: recDescription || undefined,
        scheduledAt: recScheduledAt ? new Date(recScheduledAt).toISOString() : undefined,
        isShoppable: false,
      });
      toast.success('Recorded event created successfully!');
      setModalType(null);
      resetRecordedForm();
      fetchStreams();
      fetchQuota();
    } catch (err: any) {
      const msg = err?.message || 'Failed to create recorded event';
      toast.error(`Recorded Event: ${msg}`);
      console.error('[LiveStreams] handleRecordedStream error:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleLaunchStream = async (streamId: string) => {
    try {
      await liveStreamApi.start(streamId);
      router.push(`/live-streams/${streamId}`);
    } catch (err: any) {
      const msg = err?.message || 'Failed to start stream';
      toast.error(`Go Live: ${msg}`);
      console.error('[LiveStreams] handleLaunchStream error:', err);
    }
  };

  const handleDeleteStream = async (streamId: string) => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    try {
      setDeletingId(streamId);
      await liveStreamApi.delete(streamId);
      setStreams((prev) => prev.filter((s) => s.id !== streamId));
      toast.success('Event deleted');
      fetchQuota();
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete event';
      toast.error(`Delete Event: ${msg}`);
      console.error('[LiveStreams] handleDeleteStream error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const upcomingStreams = streams.filter((s) => s.status === 'SCHEDULED' || s.status === 'LIVE');
  const pastStreams = streams.filter((s) => s.status === 'ENDED');

  return (
    <div className="space-y-6 relative min-h-[70vh]">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">Live Streaming</h1>
        <p className="text-sm text-muted-foreground">
          Host shoppable streaming events, broadcast instantly, or stream recorded content to your audience.
        </p>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ─── Left Panel: Action Cards ─── */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
            {/* Welcome Header */}
            <div className="space-y-1">
              <p className="text-sm font-medium text-violet-500">Welcome to Livestream!</p>
              <h2 className="text-xl font-bold text-foreground">What would you like to do?</h2>
            </div>

            {/* Action Cards */}
            <div className="space-y-2">
              {/* Schedule Event */}
              <button
                onClick={() => setModalType('schedule')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:bg-violet-500/5 hover:border-violet-500/30 transition-all group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500 group-hover:bg-violet-500/20 transition-colors flex-shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-sm font-bold text-foreground">Schedule Event</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Plan a live stream for a future date & time</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-violet-500 transition-colors flex-shrink-0" />
              </button>

              {/* Instant Stream */}
              <button
                onClick={handleInstantStream}
                disabled={creating}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:bg-emerald-500/5 hover:border-emerald-500/30 transition-all group cursor-pointer disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500/20 transition-colors flex-shrink-0">
                  <Play className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-sm font-bold text-foreground">Instant Stream</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Go live right now with one click</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-emerald-500 transition-colors flex-shrink-0" />
              </button>

              {/* Stream Recorded Event */}
              <button
                onClick={() => setModalType('recorded')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:bg-amber-500/5 hover:border-amber-500/30 transition-all group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:bg-amber-500/20 transition-colors flex-shrink-0">
                  <Film className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-sm font-bold text-foreground">Stream Recorded Event</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Broadcast a pre-recorded video as live</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-amber-500 transition-colors flex-shrink-0" />
              </button>
            </div>
          </div>

          {/* Past Streams Summary */}
          {pastStreams.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                Past Events
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                {pastStreams.slice(0, 5).map((stream) => (
                  <div
                    key={stream.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-background text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-foreground truncate">{stream.title}</div>
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" /> Peak: {stream.peakViewers}
                        </span>
                        <span>Total: {stream.totalViewers}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <button
                        onClick={() => router.push(`/live-streams/${stream.id}`)}
                        className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-[10px] font-bold transition-all"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDeleteStream(stream.id)}
                        disabled={deletingId !== null}
                        className="p-1 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-all disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── Right Panel: Upcoming Events ─── */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-border bg-card p-6 min-h-[400px] flex flex-col">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-500" />
              Upcoming & Live Events
            </h3>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
              </div>
            ) : upcomingStreams.length === 0 ? (
              /* Empty State */
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                {/* Rocket Illustration (SVG) */}
                <div className="relative mb-6">
                  <svg width="200" height="180" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-60">
                    {/* Stars */}
                    <path d="M40 30L42 25L44 30L49 32L44 34L42 39L40 34L35 32L40 30Z" fill="currentColor" className="text-muted-foreground/40" />
                    <path d="M150 20L152 15L154 20L159 22L154 24L152 29L150 24L145 22L150 20Z" fill="currentColor" className="text-muted-foreground/40" />
                    <path d="M30 100L32 95L34 100L39 102L34 104L32 109L30 104L25 102L30 100Z" fill="currentColor" className="text-muted-foreground/30" />
                    <path d="M170 80L172 75L174 80L179 82L174 84L172 89L170 84L165 82L170 80Z" fill="currentColor" className="text-muted-foreground/30" />
                    <path d="M60 140L62 137L64 140L67 141L64 142L62 145L60 142L57 141L60 140Z" fill="currentColor" className="text-muted-foreground/20" />
                    {/* Rocket Body */}
                    <g transform="translate(75, 40)">
                      {/* Rocket cone */}
                      <path d="M25 0L35 25H15L25 0Z" fill="currentColor" className="text-muted-foreground/30" />
                      {/* Rocket body */}
                      <rect x="15" y="25" width="20" height="50" rx="3" fill="currentColor" className="text-muted-foreground/25" />
                      {/* Window */}
                      <circle cx="25" cy="45" r="7" fill="currentColor" className="text-muted-foreground/15" />
                      <circle cx="25" cy="45" r="4" fill="currentColor" className="text-background" />
                      {/* Fins */}
                      <path d="M15 60L5 80H15V60Z" fill="currentColor" className="text-muted-foreground/20" />
                      <path d="M35 60L45 80H35V60Z" fill="currentColor" className="text-muted-foreground/20" />
                      {/* Exhaust */}
                      <path d="M18 75L25 95L32 75" fill="currentColor" className="text-violet-500/20" />
                      <path d="M21 75L25 88L29 75" fill="currentColor" className="text-violet-500/30" />
                    </g>
                  </svg>
                </div>

                <h3 className="text-lg font-bold text-foreground mb-1.5">No Upcoming Events</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Schedule your first live stream event to engage with your audience in real-time.
                </p>
                <button
                  onClick={() => setModalType('schedule')}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-violet-500/15 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Schedule Event
                </button>
              </div>
            ) : (
              /* Stream Cards */
              <div className="flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
                {upcomingStreams.map((stream) => (
                  <div
                    key={stream.id}
                    className="p-4 rounded-xl border border-border bg-background hover:bg-muted/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              stream.status === 'LIVE'
                                ? 'bg-rose-500/15 text-rose-500 animate-pulse'
                                : 'bg-amber-500/10 text-amber-500'
                            }`}
                          >
                            {stream.status === 'LIVE' ? '● LIVE' : 'SCHEDULED'}
                          </span>
                          {stream.isShoppable && (
                            <span className="flex items-center gap-0.5 text-[10px] text-violet-500 bg-violet-500/10 px-2 py-0.5 rounded-full font-semibold">
                              <Tag className="w-3 h-3" /> Shoppable
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-foreground text-sm line-clamp-1">{stream.title}</h4>
                        {stream.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{stream.description}</p>
                        )}
                        {stream.scheduledAt && (
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-violet-500" />
                              {new Date(stream.scheduledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-violet-500" />
                              {new Date(stream.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                        {stream.status === 'LIVE' ? (
                          <button
                            onClick={() => router.push(`/live-streams/${stream.id}`)}
                            className="px-3.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all animate-pulse"
                          >
                            Join Stream
                          </button>
                        ) : (
                          <button
                            onClick={() => handleLaunchStream(stream.id)}
                            className="px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all"
                          >
                            Go Live
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteStream(stream.id)}
                          disabled={deletingId !== null}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-all disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Quota Badge (Floating, Bottom-Right) ─── */}
      <div className="fixed bottom-6 right-6 z-40">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-card border border-border shadow-xl text-sm font-bold text-foreground">
          <Users className="w-4 h-4 text-violet-500" />
          <span className="text-violet-500">{quota.count}</span>
          <span className="text-muted-foreground">/</span>
          <span>{quota.limit}</span>
        </div>
      </div>

      {/* ─── Schedule Event Modal ─── */}
      {modalType === 'schedule' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 bg-card border border-border rounded-2xl shadow-xl space-y-6 mx-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-violet-500" />
                Schedule Event
              </h3>
              <button
                onClick={() => { setModalType(null); resetScheduleForm(); }}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleStream} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Event Title *</label>
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
                  placeholder="Describe your stream event, promo codes, products to showcase..."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
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

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { setModalType(null); resetScheduleForm(); }}
                  className="flex-1 py-2.5 border border-border rounded-lg text-sm font-semibold hover:bg-muted text-foreground transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-lg text-white font-semibold text-sm gradient-primary hover:opacity-95 disabled:opacity-50 transition-all"
                >
                  {creating ? 'Scheduling...' : 'Schedule Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Stream Recorded Event Modal ─── */}
      {modalType === 'recorded' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 bg-card border border-border rounded-2xl shadow-xl space-y-6 mx-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Film className="w-5 h-5 text-amber-500" />
                Stream Recorded Event
              </h3>
              <button
                onClick={() => { setModalType(null); resetRecordedForm(); }}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordedStream} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Product Launch Replay"
                  value={recTitle}
                  onChange={(e) => setRecTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Video URL *</label>
                <input
                  type="url"
                  required
                  placeholder="https://your-cdn.com/recording.mp4"
                  value={recVideoUrl}
                  onChange={(e) => setRecVideoUrl(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
                <p className="text-[10px] text-muted-foreground">Paste a direct link to your pre-recorded video file</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <textarea
                  placeholder="Brief description of the recorded event..."
                  rows={2}
                  value={recDescription}
                  onChange={(e) => setRecDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Schedule Broadcast (Optional)</label>
                <input
                  type="datetime-local"
                  value={recScheduledAt}
                  onChange={(e) => setRecScheduledAt(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { setModalType(null); resetRecordedForm(); }}
                  className="flex-1 py-2.5 border border-border rounded-lg text-sm font-semibold hover:bg-muted text-foreground transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-lg text-white font-semibold text-sm bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-all"
                >
                  {creating ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

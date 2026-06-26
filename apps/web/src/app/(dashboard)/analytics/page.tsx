'use client';

import { useState, useEffect } from 'react';
import {
  Eye,
  MessageSquare,
  PhoneCall,
  Sparkles,
  MousePointerClick,
  TrendingUp,
  FileText,
  Search,
  Activity,
  RefreshCw,
  CheckCircle2,
  Database,
  Users,
  Globe,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { analyticsApi, searchApi } from '@/lib/api-client';

interface OverviewSummary {
  pageViews: number;
  widgetOpens: number;
  chatStarts: number;
  videoCalls: number;
  videoWatches: number;
  productClicks: number;
  formSubmits: number;
  ctr: number;
}

interface ChartItem {
  date: string;
  views: number;
  clicks: number;
}

interface VisitorEvent {
  id: string;
  type: string;
  page?: string;
  createdAt: string;
}

interface Visitor {
  id: string;
  fingerprint: string;
  email?: string;
  name?: string;
  country?: string;
  city?: string;
  lastSeenAt: string;
  createdAt: string;
  events: VisitorEvent[];
}

const EVENT_COLORS: Record<string, string> = {
  PAGE_VIEW: 'bg-indigo-500/20 text-indigo-300',
  WIDGET_OPEN: 'bg-cyan-500/20 text-cyan-300',
  CHAT_START: 'bg-violet-500/20 text-violet-300',
  VIDEO_CALL_REQUEST: 'bg-rose-500/20 text-rose-300',
  VIDEO_WATCH: 'bg-amber-500/20 text-amber-300',
  PRODUCT_CLICK: 'bg-emerald-500/20 text-emerald-300',
  FORM_SUBMIT: 'bg-blue-500/20 text-blue-300',
};

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'Just now';
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<OverviewSummary | null>(null);
  const [chartData, setChartData] = useState<ChartItem[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [visitorsLoading, setVisitorsLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [expandedVisitor, setExpandedVisitor] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    fetchVisitors();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await analyticsApi.getOverview();
      if (res) {
        setSummary(res.summary);
        setChartData(res.chartData || []);
      }
    } catch {
      toast.error('Failed to load analytics stats');
    } finally {
      setLoading(false);
    }
  };

  const fetchVisitors = async () => {
    try {
      const res = await analyticsApi.getVisitors(20);
      if (Array.isArray(res)) setVisitors(res);
    } catch {
      // silently ignore
    } finally {
      setVisitorsLoading(false);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    try {
      await searchApi.reindex();
      toast.success('Search index rebuilt successfully');
    } catch {
      toast.error('Failed to rebuild search index');
    } finally {
      setReindexing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="w-8 h-8 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
      </div>
    );
  }

  // Calculate total interactions
  const totalInteractions =
    (summary?.widgetOpens || 0) +
    (summary?.chatStarts || 0) +
    (summary?.videoCalls || 0) +
    (summary?.videoWatches || 0) +
    (summary?.productClicks || 0);

  // SVG Chart Dimensions & Computations
  const chartHeight = 160;
  const chartWidth = 500;
  const padding = 20;

  const maxVal = Math.max(...chartData.map((d) => Math.max(d.views, d.clicks)), 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-card border border-border flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics Overview</h1>
          <p className="text-muted-foreground mt-1">
            Track real-time traffic, widget interaction logs, and product conversion rates.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchStats(); fetchVisitors(); toast.success('Data refreshed'); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-violet-500/50 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <TrendingUp className="w-3.5 h-3.5" />
            Live Metrics
          </div>
        </div>
      </div>

      {/* Grid Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Page Views */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Page Views</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground">{summary?.pageViews ?? 0}</h2>
            <p className="text-[10px] text-muted-foreground mt-1">Unique page loading triggers logged</p>
          </div>
        </div>

        {/* Widget Opens */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Engagements</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <MousePointerClick className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground">{totalInteractions}</h2>
            <p className="text-[10px] text-muted-foreground mt-1">Clicks, chat opens & stream plays</p>
          </div>
        </div>

        {/* Chat Sessions */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Support Chats</span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground">{summary?.chatStarts ?? 0}</h2>
            <p className="text-[10px] text-muted-foreground mt-1">AI support conversations started</p>
          </div>
        </div>

        {/* CTR */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product Click CTR</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground">{summary?.ctr ?? 0}%</h2>
            <p className="text-[10px] text-muted-foreground mt-1">Percentage of product hotspot clicks</p>
          </div>
        </div>
      </div>

      {/* Main Charts & Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVG Chart Panel */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Traffic & Interactions (7 Days)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Visualizing views against direct interactive actions</p>
          </div>

          <div className="relative w-full h-[220px] flex items-center justify-center bg-zinc-950/40 border border-zinc-900 rounded-xl p-4">
            {chartData.every(d => d.views === 0 && d.clicks === 0) ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <Activity className="w-8 h-8 text-zinc-700" />
                <p className="text-sm font-semibold text-zinc-500">No interaction data yet</p>
                <p className="text-xs text-zinc-600">Embed the widget on your site to start tracking</p>
              </div>
            ) : (
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-full overflow-visible"
              >
                {/* Gradients */}
                <defs>
                  <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((r, idx) => {
                  const y = padding + r * (chartHeight - 2 * padding);
                  const val = Math.round(maxVal - r * maxVal);
                  return (
                    <g key={idx}>
                      <line
                        x1={padding}
                        y1={y}
                        x2={chartWidth - padding}
                        y2={y}
                        stroke="#27272a"
                        strokeWidth="1"
                        strokeDasharray="4"
                      />
                      <text
                        x={5}
                        y={y + 3}
                        fill="#71717a"
                        fontSize="9"
                        fontFamily="monospace"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Line paths */}
                {chartData.length > 1 && (
                  <>
                    {/* Views Path Area & Line */}
                    <path
                      d={(() => {
                        const points = chartData.map((d, i) => {
                          const x = padding + (i / (chartData.length - 1)) * (chartWidth - 2 * padding);
                          const y = chartHeight - padding - (d.views / maxVal) * (chartHeight - 2 * padding);
                          return `${x},${y}`;
                        });
                        return `M ${points.join(' L ')} L ${padding + (chartData.length - 1) * (chartWidth - 2 * padding) / (chartData.length - 1) * (chartWidth - 2 * padding)},${chartHeight - padding} L ${padding},${chartHeight - padding} Z`;
                      })()}
                      fill="url(#viewsGrad)"
                    />
                    <path
                      d={chartData.map((d, i) => {
                        const x = padding + (i / (chartData.length - 1)) * (chartWidth - 2 * padding);
                        const y = chartHeight - padding - (d.views / maxVal) * (chartHeight - 2 * padding);
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="2.5"
                    />

                    {/* Clicks Path Area & Line */}
                    <path
                      d={(() => {
                        const points = chartData.map((d, i) => {
                          const x = padding + (i / (chartData.length - 1)) * (chartWidth - 2 * padding);
                          const y = chartHeight - padding - (d.clicks / maxVal) * (chartHeight - 2 * padding);
                          return `${x},${y}`;
                        });
                        return `M ${points.join(' L ')} L ${padding + (chartData.length - 1) * (chartWidth - 2 * padding) / (chartData.length - 1) * (chartWidth - 2 * padding)},${chartHeight - padding} L ${padding},${chartHeight - padding} Z`;
                      })()}
                      fill="url(#clicksGrad)"
                    />
                    <path
                      d={chartData.map((d, i) => {
                        const x = padding + (i / (chartData.length - 1)) * (chartWidth - 2 * padding);
                        const y = chartHeight - padding - (d.clicks / maxVal) * (chartHeight - 2 * padding);
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                    />
                  </>
                )}

                {/* Data Node circles */}
                {chartData.map((d, i) => {
                  const x = padding + (i / (chartData.length - 1)) * (chartWidth - 2 * padding);
                  const yViews = chartHeight - padding - (d.views / maxVal) * (chartHeight - 2 * padding);
                  const yClicks = chartHeight - padding - (d.clicks / maxVal) * (chartHeight - 2 * padding);
                  return (
                    <g key={i}>
                      <circle cx={x} cy={yViews} r="3.5" fill="#6366f1" />
                      <circle cx={x} cy={yClicks} r="3.5" fill="#10b981" />
                      <text
                        x={x}
                        y={chartHeight - 4}
                        fill="#71717a"
                        fontSize="9"
                        textAnchor="middle"
                      >
                        {d.date}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Legend */}
            <div className="absolute top-4 right-4 flex gap-4 text-[10px] font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                Page Views
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Interactions
              </span>
            </div>
          </div>
        </div>

        {/* Channels Breakdown */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Interaction Channels</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Distribution of engagements</p>
          </div>

          <div className="space-y-3.5 pt-2">
            {[
              { name: 'Widget Opens', count: summary?.widgetOpens || 0, color: 'bg-indigo-500' },
              { name: 'Video Watches', count: summary?.videoWatches || 0, color: 'bg-cyan-500' },
              { name: 'Product Hotspot Clicks', count: summary?.productClicks || 0, color: 'bg-emerald-500' },
              { name: 'AI Chat Initiations', count: summary?.chatStarts || 0, color: 'bg-violet-500' },
              { name: 'Video Call Requests', count: summary?.videoCalls || 0, color: 'bg-rose-500' },
              { name: 'Inbound Form Submits', count: summary?.formSubmits || 0, color: 'bg-amber-500' },
            ].map((chan) => {
              const pct = totalInteractions > 0 ? Math.round((chan.count / totalInteractions) * 100) : 0;
              return (
                <div key={chan.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-300 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${chan.color}`} />
                      {chan.name}
                    </span>
                    <span className="text-muted-foreground font-mono">
                      {chan.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${chan.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Real Visitor Logs Section */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Recent Visitors</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Live visitor logs from your embedded widget</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-500">{visitors.length} visitors</span>
            {visitors.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}
          </div>
        </div>

        {visitorsLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
          </div>
        ) : visitors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
              <Globe className="w-6 h-6 text-zinc-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-400">No visitors tracked yet</p>
              <p className="text-xs text-zinc-600 mt-1">
                Embed the widget script on your website to start tracking visitors
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {visitors.map((visitor) => (
              <div
                key={visitor.id}
                className="rounded-xl border border-border/60 bg-zinc-950/30 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedVisitor(expandedVisitor === visitor.id ? null : visitor.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-zinc-900/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {visitor.name ? visitor.name[0].toUpperCase() : visitor.fingerprint.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-200">
                        {visitor.name || visitor.email || `Visitor ${visitor.fingerprint.substring(0, 8)}`}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {visitor.country && visitor.country !== 'Unknown' && (
                          <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                            <Globe className="w-2.5 h-2.5" />
                            {visitor.city && visitor.city !== 'Unknown' ? `${visitor.city}, ` : ''}{visitor.country}
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatRelativeTime(visitor.lastSeenAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      {Array.from(new Set(visitor.events.map(e => e.type))).slice(0, 4).map((type) => (
                        <span
                          key={type}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${EVENT_COLORS[type] || 'bg-zinc-700/50 text-zinc-400'}`}
                        >
                          {type.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                    <span className="text-[10px] font-mono text-zinc-600">{visitor.events.length} events</span>
                    {expandedVisitor === visitor.id ? (
                      <ChevronUp className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    )}
                  </div>
                </button>

                {expandedVisitor === visitor.id && (
                  <div className="px-4 pb-4 space-y-2 border-t border-border/40 pt-3">
                    {visitor.email && (
                      <p className="text-xs text-zinc-400">
                        <span className="text-zinc-600">Email:</span> {visitor.email}
                      </p>
                    )}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Event Timeline</p>
                      {visitor.events.slice(0, 8).map((event) => (
                        <div key={event.id} className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${EVENT_COLORS[event.type] || 'bg-zinc-700/50 text-zinc-400'}`}
                          >
                            {event.type.replace(/_/g, ' ')}
                          </span>
                          {event.page && (
                            <span className="text-[10px] text-zinc-500 truncate">{event.page}</span>
                          )}
                          <span className="text-[10px] text-zinc-700 ml-auto shrink-0">
                            {formatRelativeTime(event.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PostHog Connection Card */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">PostHog Analytics</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Server-side event capture pipeline</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" />
              Connected
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border">
              <span className="text-xs font-semibold text-zinc-400">Capture Endpoint</span>
              <code className="text-[11px] font-mono text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded">
                {process.env.NEXT_PUBLIC_POSTHOG_HOST || 'http://localhost:8000'}/capture/
              </code>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border">
              <span className="text-xs font-semibold text-zinc-400">API Key</span>
              <code className="text-[11px] font-mono text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded">
                {(process.env.NEXT_PUBLIC_POSTHOG_API_KEY || 'phc_dev_key').slice(0, 12)}...
              </code>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border">
              <span className="text-xs font-semibold text-zinc-400">Tracked Events</span>
              <span className="text-xs font-bold text-foreground">
                video_call_joined, stream_created, plan_upgraded
              </span>
            </div>
          </div>
        </div>

        {/* Meilisearch Reindex Card */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Meilisearch Engine</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Global full-text search index</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              <Database className="w-3 h-3" />
              Active
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border">
              <span className="text-xs font-semibold text-zinc-400">Search Host</span>
              <code className="text-[11px] font-mono text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded">
                http://localhost:7700
              </code>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border">
              <span className="text-xs font-semibold text-zinc-400">Indexed Types</span>
              <span className="text-xs font-bold text-foreground">
                Videos, FAQs, Contacts, Leads
              </span>
            </div>

            <button
              onClick={handleReindex}
              disabled={reindexing}
              className="w-full mt-2 flex items-center justify-center gap-2 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all duration-200"
            >
              <RefreshCw className={`w-4 h-4 ${reindexing ? 'animate-spin' : ''}`} />
              {reindexing ? 'Rebuilding Index...' : 'Rebuild Search Index'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

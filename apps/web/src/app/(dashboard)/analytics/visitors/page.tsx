'use client';

import { useState, useEffect } from 'react';
import {
  Globe,
  Monitor,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  History,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { analyticsApi } from '@/lib/api-client';

interface VisitorEvent {
  id: string;
  type: string;
  page?: string;
  referrer?: string;
  duration?: number;
  metadata?: any;
  createdAt: string;
}

interface Visitor {
  id: string;
  fingerprint: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  referrer?: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  events: VisitorEvent[];
}

export default function VisitorsPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVisitorId, setExpandedVisitorId] = useState<string | null>(null);

  useEffect(() => {
    fetchVisitors();
  }, []);

  const fetchVisitors = async () => {
    try {
      const res = await analyticsApi.getVisitors(50);
      setVisitors(res || []);
    } catch {
      toast.error('Failed to load visitors list');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedVisitorId(expandedVisitorId === id ? null : id);
  };

  // Helper to parse OS/Browser from userAgent
  const getAgentDetails = (uaString: string | null | undefined) => {
    if (!uaString) return 'Unknown Browser';
    if (uaString.includes('Windows')) return 'Windows · Chrome';
    if (uaString.includes('Macintosh')) return 'macOS · Safari';
    if (uaString.includes('iPhone') || uaString.includes('iPad')) return 'iOS · Safari';
    if (uaString.includes('Android')) return 'Android · Chrome';
    if (uaString.includes('Linux')) return 'Linux · Firefox';
    return 'Web Browser';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="w-8 h-8 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-card border border-border">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <History className="w-6 h-6 text-violet-500" />
          Visitor Sessions & Logs
        </h1>
        <p className="text-muted-foreground mt-1">
          Inspect fingerprinted visitors, device metadata, geographical details, and click activity feeds.
        </p>
      </div>

      {/* Visitors List Grid */}
      {visitors.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-500">
            <User className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground font-sans">No Visitor Logs Found</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
            Traffic event tracking is active. Visitor data will automatically stream here once you embed the script loader onto a webpage.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visitors.map((visitor) => {
            const isExpanded = expandedVisitorId === visitor.id;
            return (
              <div
                key={visitor.id}
                className="rounded-xl border border-border bg-card overflow-hidden transition-all duration-200"
              >
                {/* Visitor Main Row Card */}
                <div
                  onClick={() => toggleExpand(visitor.id)}
                  className="flex flex-col md:flex-row md:items-center justify-between p-5 gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center">
                      <User className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                        {visitor.name || visitor.email || `Visitor #${visitor.fingerprint.substring(0, 6)}`}
                        {visitor.email && (
                          <span className="text-[9px] bg-zinc-800 text-zinc-400 font-mono px-2 py-0.5 rounded-full border border-zinc-700/80">
                            {visitor.email}
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                        Fingerprint: {visitor.fingerprint}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-violet-500" />
                      {visitor.city && visitor.city !== 'Unknown' ? `${visitor.city}, ` : ''}{visitor.country || 'Unknown'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Monitor className="w-3.5 h-3.5 text-violet-500" />
                      {getAgentDetails(visitor.userAgent)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-violet-500" />
                      Last seen {new Date(visitor.lastSeenAt).toLocaleTimeString()}
                    </span>
                    <span className="text-[10px] font-semibold text-violet-500 font-mono px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                      {visitor.events.length} events
                    </span>
                  </div>

                  <div className="text-muted-foreground self-end md:self-auto">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>

                {/* Collapsible Timeline Details */}
                {isExpanded && (
                  <div className="border-t border-border bg-zinc-950/20 p-5 space-y-4">
                    {/* Visitor Metadata block */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-card border border-border/80 text-[11px] text-zinc-300">
                      <div>
                        <span className="text-muted-foreground block mb-0.5">IP Address</span>
                        <span className="font-mono">{visitor.ip || '127.0.0.1'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Geographical Location</span>
                        <span>{visitor.city || 'Local'}({visitor.country || 'Host'})</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">First Seen At</span>
                        <span>{new Date(visitor.firstSeenAt).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Reference Source</span>
                        <span className="truncate block" title={visitor.referrer || 'Direct Link'}>
                          {visitor.referrer || 'Direct URL'}
                        </span>
                      </div>
                    </div>

                    {/* Timeline Feed list */}
                    <div className="space-y-4">
                      <h5 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-violet-500" />
                        Session Event Feed Timeline
                      </h5>

                      <div className="relative border-l border-border/80 pl-4 ml-2.5 space-y-4">
                        {visitor.events.map((ev, idx) => (
                          <div key={ev.id} className="relative group/timeline">
                            {/* Bullet icon */}
                            <span className="absolute -left-[22.5px] top-1.5 w-3 h-3 rounded-full border-2 border-card bg-violet-500 shadow-md shadow-violet-500/20" />
                            
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-foreground uppercase tracking-wide">
                                  {ev.type.replace('_', ' ')}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(ev.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                              {ev.page && (
                                <p className="text-[11px] text-zinc-400 font-mono">
                                  Page: {ev.page}
                                </p>
                              )}
                              {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                                <div className="p-2.5 rounded-lg bg-card border border-border/60 text-[10px] text-muted-foreground font-mono max-w-[500px] overflow-x-auto">
                                  {JSON.stringify(ev.metadata)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

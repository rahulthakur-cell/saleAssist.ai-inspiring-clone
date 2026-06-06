'use client';

import { cn, formatNumber, formatCurrency, formatDuration } from '@/lib/utils';

// ─── Mock Data (will be replaced with API calls) ──────

const stats = [
  {
    name: 'Total Calls',
    value: 1247,
    change: +12.5,
    icon: VideoStatsIcon,
    color: 'from-indigo-500 to-indigo-600',
    bgColor: 'bg-indigo-500/10',
    textColor: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    name: 'Active Leads',
    value: 342,
    change: +8.2,
    icon: LeadStatsIcon,
    color: 'from-emerald-500 to-emerald-600',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    name: 'Revenue',
    value: 48250,
    change: +23.1,
    isCurrency: true,
    icon: RevenueStatsIcon,
    color: 'from-violet-500 to-violet-600',
    bgColor: 'bg-violet-500/10',
    textColor: 'text-violet-600 dark:text-violet-400',
  },
  {
    name: 'Avg. Call Duration',
    value: 432,
    change: -3.4,
    isDuration: true,
    icon: ClockStatsIcon,
    color: 'from-amber-500 to-amber-600',
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
];

const recentActivities = [
  { id: 1, type: 'video_call', title: 'Video call with Sarah Chen', time: '5 min ago', status: 'completed', color: 'bg-indigo-500' },
  { id: 2, type: 'lead', title: 'New lead from widget — John D.', time: '12 min ago', status: 'new', color: 'bg-emerald-500' },
  { id: 3, type: 'deal', title: 'Deal "Enterprise Plan" moved to Negotiation', time: '28 min ago', status: 'updated', color: 'bg-violet-500' },
  { id: 4, type: 'stream', title: 'Live stream "Summer Collection" ended', time: '1h ago', status: 'ended', color: 'bg-amber-500' },
  { id: 5, type: 'video_call', title: 'Missed call from visitor #4821', time: '2h ago', status: 'missed', color: 'bg-red-500' },
  { id: 6, type: 'ai_chat', title: 'AI chat session — 14 messages', time: '3h ago', status: 'completed', color: 'bg-cyan-500' },
];

const agentPerformance = [
  { name: 'Sarah K.', calls: 45, leads: 12, rating: 4.8, avatar: 'SK' },
  { name: 'Mike R.', calls: 38, leads: 9, rating: 4.6, avatar: 'MR' },
  { name: 'Emily T.', calls: 32, leads: 15, rating: 4.9, avatar: 'ET' },
  { name: 'James L.', calls: 28, leads: 7, rating: 4.5, avatar: 'JL' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back! Here&apos;s an overview of your video commerce performance.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 hover:shadow-lg hover:shadow-black/5 transition-all duration-300"
            >
              {/* Gradient accent */}
              <div className={cn('absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full bg-gradient-to-br opacity-10 group-hover:opacity-20 transition-opacity', stat.color)} />

              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                    <Icon className={cn('w-5 h-5', stat.textColor)} />
                  </div>
                  <span
                    className={cn(
                      'text-xs font-semibold px-2 py-1 rounded-full',
                      stat.change >= 0
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400',
                    )}
                  >
                    {stat.change >= 0 ? '↑' : '↓'} {Math.abs(stat.change)}%
                  </span>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {stat.isCurrency
                    ? formatCurrency(stat.value)
                    : stat.isDuration
                      ? formatDuration(stat.value)
                      : formatNumber(stat.value)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">{stat.name}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
            <button className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
              View all
            </button>
          </div>
          <div className="divide-y divide-border">
            {recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-4 p-4 hover:bg-accent/30 transition-colors"
              >
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0', activity.color)} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {activity.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {activity.time}
                  </div>
                </div>
                <span
                  className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full capitalize',
                    activity.status === 'completed' && 'bg-emerald-500/10 text-emerald-600',
                    activity.status === 'new' && 'bg-indigo-500/10 text-indigo-600',
                    activity.status === 'updated' && 'bg-violet-500/10 text-violet-600',
                    activity.status === 'ended' && 'bg-muted text-muted-foreground',
                    activity.status === 'missed' && 'bg-red-500/10 text-red-600',
                  )}
                >
                  {activity.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Performance */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Top Agents</h2>
            <button className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
              View all
            </button>
          </div>
          <div className="p-4 space-y-4">
            {agentPerformance.map((agent, i) => (
              <div key={agent.name} className="flex items-center gap-3">
                <span className="w-5 text-xs text-muted-foreground font-medium">#{i + 1}</span>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{
                    backgroundColor: `hsl(${(i * 90 + 245) % 360}, 60%, 55%)`,
                  }}
                >
                  {agent.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{agent.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {agent.calls} calls · {agent.leads} leads
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm font-medium text-amber-500">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  {agent.rating}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Start Video Call', description: 'Connect with a visitor now', icon: '📹', gradient: 'from-indigo-500/10 to-violet-500/10', border: 'border-indigo-200 dark:border-indigo-900' },
          { title: 'Go Live', description: 'Start a live shopping stream', icon: '📡', gradient: 'from-red-500/10 to-pink-500/10', border: 'border-red-200 dark:border-red-900' },
          { title: 'Upload Video', description: 'Add a shoppable video', icon: '🎬', gradient: 'from-emerald-500/10 to-teal-500/10', border: 'border-emerald-200 dark:border-emerald-900' },
          { title: 'Add Lead', description: 'Create a new lead manually', icon: '✨', gradient: 'from-amber-500/10 to-orange-500/10', border: 'border-amber-200 dark:border-amber-900' },
        ].map((action) => (
          <button
            key={action.title}
            className={cn(
              'group relative overflow-hidden rounded-xl border p-5 text-left hover:shadow-md transition-all duration-300',
              action.border,
            )}
          >
            <div className={cn('absolute inset-0 bg-gradient-to-br opacity-50 group-hover:opacity-80 transition-opacity', action.gradient)} />
            <div className="relative">
              <span className="text-2xl">{action.icon}</span>
              <div className="text-sm font-semibold text-foreground mt-3">{action.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{action.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Stats Icons ──────────────────────────────────────

function VideoStatsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect width="15" height="14" x="1" y="5" rx="2" ry="2" /></svg>;
}
function LeadStatsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" /></svg>;
}
function RevenueStatsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
}
function ClockStatsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
}

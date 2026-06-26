'use client';

import { useState, useEffect } from 'react';
import { cn, formatNumber, formatCurrency, formatDuration } from '@/lib/utils';
import { analyticsApi } from '@/lib/api-client';
import { toast } from 'sonner';

import {
  Video,
  Users,
  DollarSign,
  Clock,
  ArrowRight,
  TrendingUp,
  Bot
} from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const res = await analyticsApi.getDashboard();
      if (res) {
        setData(res);
      }
    } catch (err: any) {
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="w-8 h-8 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  const stats = [
    {
      name: 'Total Calls',
      value: data?.stats?.totalCalls ?? 0,
      icon: Video,
      color: 'from-indigo-500 to-indigo-600',
      bgColor: 'bg-indigo-500/10',
      textColor: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      name: 'Active Leads',
      value: data?.stats?.activeLeads ?? 0,
      icon: Users,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-500/10',
      textColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      name: 'Revenue',
      value: data?.stats?.revenue ?? 0,
      isCurrency: true,
      icon: DollarSign,
      color: 'from-violet-500 to-violet-600',
      bgColor: 'bg-violet-500/10',
      textColor: 'text-violet-600 dark:text-violet-400',
    },
    {
      name: 'Avg. Call Duration',
      value: data?.stats?.avgCallDuration ?? 0,
      isDuration: true,
      icon: Clock,
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-500/10',
      textColor: 'text-amber-600 dark:text-amber-400',
    },
  ];

  const recentActivities = data?.recentActivities || [];
  const agentPerformance = data?.agentPerformance || [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here&apos;s an overview of your video commerce performance.
          </p>
        </div>
        <div>
          <button
            onClick={() => { fetchDashboardStats(); toast.success('Stats updated'); }}
            className="px-4 py-2 rounded-xl bg-card border border-border hover:border-violet-500/50 text-sm font-semibold transition-all"
          >
            Refresh Data
          </button>
        </div>
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
          </div>
          <div className="divide-y divide-border">
            {recentActivities.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No recent activity logged yet. Live events show up here.
              </div>
            ) : (
              recentActivities.map((activity: any) => (
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
                      {new Date(activity.time).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
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
              ))
            )}
          </div>
        </div>

        {/* Agent Performance */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Top Agents</h2>
          </div>
          <div className="p-4 space-y-4">
            {agentPerformance.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No team agents added yet.
              </div>
            ) : (
              agentPerformance.map((agent: any, i: number) => (
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
              ))
            )}
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

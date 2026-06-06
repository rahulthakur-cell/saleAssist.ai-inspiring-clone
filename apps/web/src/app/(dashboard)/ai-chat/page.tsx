'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Plus,
  Bot,
  Calendar,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { aiChatApi } from '@/lib/api-client';

interface ChatSession {
  id: string;
  title: string;
  model: string;
  createdAt: string;
}

export default function AiChatPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await aiChatApi.listSessions();
      setSessions(res || []);
    } catch {
      toast.error('Failed to load support sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async () => {
    setCreating(true);
    try {
      const newSession = await aiChatApi.createSession({
        title: `Support Session #${sessions.length + 1}`,
      });
      toast.success('New support session created!');
      router.push(`/ai-chat/${newSession.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start support session');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl bg-card border border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="w-6 h-6 text-cyan-500 animate-pulse" />
            AI Support Assistant
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and engage in AI-powered chat support sessions with visitors.
          </p>
        </div>

        <button
          onClick={handleStartSession}
          disabled={creating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white gradient-primary hover:opacity-95 shadow-md shadow-violet-500/20 disabled:opacity-50 transition-all animate-shimmer"
        >
          <Plus className="w-4 h-4" />
          {creating ? 'Starting...' : 'New Chat Session'}
        </button>
      </div>

      {/* Sessions Content */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="w-8 h-8 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No Chat Sessions Yet</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Start a new session to chat with the AI assistant, test prompts, and preview the LiteLLM response streaming interface.
          </p>
          <button
            onClick={handleStartSession}
            disabled={creating}
            className="mt-6 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg shadow-lg shadow-cyan-500/10 transition-all"
          >
            Start First Session
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => router.push(`/ai-chat/${session.id}`)}
              className="group p-5 rounded-2xl border border-border bg-card cursor-pointer hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/5 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                    <MessageSquare className="w-4.5 h-4.5" />
                  </div>
                  <span className="flex items-center gap-1 text-[10px] bg-zinc-800 text-zinc-300 font-mono px-2 py-0.5 rounded-full border border-zinc-700">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    {session.model}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-foreground group-hover:text-cyan-400 transition-colors line-clamp-1">
                    {session.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    ID: {session.id.substring(0, 8)}...
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/60 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                  {new Date(session.createdAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-0.5 font-semibold text-cyan-500 group-hover:translate-x-0.5 transition-transform">
                  Enter Chat
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

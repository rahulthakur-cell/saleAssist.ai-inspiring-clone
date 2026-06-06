'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Phone,
  PhoneOff,
  Video,
  Clock,
  User,
  Check,
  X,
  History,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { tenantApi, videoCallApi } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { Socket } from 'socket.io-client';

interface CallRecord {
  id: string;
  roomName: string;
  status: string;
  visitorName: string;
  visitorEmail?: string;
  visitorPhone?: string;
  createdAt: string;
  durationSeconds?: number;
}

export default function VideoCallsPage() {
  const router = useRouter();
  const [isAvailable, setIsAvailable] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [activeCallRequests, setActiveCallRequests] = useState<any[]>([]);
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [showOutboundModal, setShowOutboundModal] = useState(false);
  const [outboundName, setOutboundName] = useState('');
  const [outboundEmail, setOutboundEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize socket
  useEffect(() => {
    const s = getSocket('/video');
    setSocket(s);

    s.connect();

    s.on('connect', () => {
      console.log('Connected to video socket');
    });

    s.on('agent:availability-changed', (data: { agentId: string; isAvailable: boolean }) => {
      // Typically we'd check if it's this agent, but let's sync state
      // When agent toggles successfully, our own action updates local state
    });

    s.on('call:incoming', (data: { callId: string; roomName: string; visitorName: string; assignedAgentId?: string }) => {
      // Ringing state
      toast.info(`Incoming video call request from ${data.visitorName}!`, {
        duration: 15000,
        action: {
          label: 'Answer',
          onClick: () => handleAcceptCall(data.callId),
        },
      });

      setActiveCallRequests((prev) => {
        if (prev.some((req) => req.callId === data.callId)) return prev;
        return [...prev, data];
      });
    });

    s.on('call:queue-update', (data: { waitingCount: number }) => {
      setWaitingCount(data.waitingCount);
    });

    s.on('call:rejected-by-agent', (data: { callId: string; agentId: string }) => {
      setActiveCallRequests((prev) => prev.filter((req) => req.callId !== data.callId));
    });

    // Fetch initial data
    fetchInitialData();

    return () => {
      s.disconnect();
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      // Fetch queue
      const qRes = await videoCallApi.getQueue();
      setWaitingCount(qRes.waitingCount);

      // Fetch call history
      const hRes = await videoCallApi.list(10, 1);
      setCallHistory(hRes.data || []);

      // Get agent profile status
      // We can also fetch the current TenantUser availability to sync isAvailable
      await tenantApi.getCurrent();
    } catch (err: any) {
      console.error('Failed to load initial call data', err);
    }
  };

  const toggleAvailability = () => {
    if (!socket) return;
    const nextState = !isAvailable;
    setIsAvailable(nextState);

    socket.emit('agent:toggle-availability', { isAvailable: nextState }, (res: any) => {
      if (res && res.event === 'success') {
        toast.success(`Availability set to ${nextState ? 'Online' : 'Offline'}`);
      } else {
        toast.error('Failed to update status');
        setIsAvailable(!nextState); // Rollback
      }
    });
  };

  const handleAcceptCall = (callId: string) => {
    if (!socket) return;
    socket.emit('call:accept', { callId });
    setActiveCallRequests((prev) => prev.filter((req) => req.callId !== callId));
    router.push(`/video-calls/${callId}`);
  };

  const handleRejectCall = (callId: string) => {
    if (!socket) return;
    socket.emit('call:reject', { callId });
    setActiveCallRequests((prev) => prev.filter((req) => req.callId !== callId));
    toast.info('Call declined');
  };

  const handleStartOutbound = async (e: React.FormEvent) => {
    e.preventDefault();
    const customerName = outboundName.trim();
    const customerEmail = outboundEmail.trim();
    if (!customerName || !customerEmail) return;

    setLoading(true);
    try {
      const call = await videoCallApi.create({
        type: 'OUTBOUND',
        visitorName: customerName,
        visitorEmail: customerEmail,
      });

      if (call.inviteEmailSent) {
        toast.success(`Video call invite sent to ${customerEmail}`);
      } else if (call.inviteUrl) {
        toast.warning(
          call.inviteEmailError
            ? `Call room created, but email was not sent: ${call.inviteEmailError}`
            : 'Call room created, but email was not sent. Copy the invite link from the call details.',
        );
      } else {
        toast.warning(call.inviteEmailError || 'Call room created, but email was not sent.');
      }
      setShowOutboundModal(false);
      router.push(`/video-calls/${call.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate call');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Availability */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl bg-card border border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Video Calls Control Center</h1>
          <p className="text-muted-foreground mt-1">Manage inbound queues and host client consultations in real time.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={toggleAvailability}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md ${
              isAvailable
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                : 'bg-zinc-500 hover:bg-zinc-600 text-white shadow-zinc-500/20'
            }`}
          >
            {isAvailable ? <Phone className="w-4 h-4 animate-pulse" /> : <PhoneOff className="w-4 h-4" />}
            Status: {isAvailable ? 'Online & Ready' : 'Offline'}
          </button>

          <button
            onClick={() => setShowOutboundModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white gradient-primary hover:opacity-95 shadow-md shadow-violet-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Outbound Call
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Ringing & Queue Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ringing Calls */}
          {activeCallRequests.length > 0 && (
            <div className="p-6 rounded-2xl border border-rose-500/30 bg-rose-950/10 space-y-4">
              <h2 className="text-lg font-bold text-rose-500 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 animate-bounce" />
                Ringing Inbound Calls
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeCallRequests.map((req) => (
                  <div
                    key={req.callId}
                    className="p-4 rounded-xl border border-rose-500/20 bg-background flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-500">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{req.visitorName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Inbound Request</div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptCall(req.callId)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-all"
                      >
                        <Check className="w-4 h-4" /> Accept
                      </button>
                      <button
                        onClick={() => handleRejectCall(req.callId)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold transition-all"
                      >
                        <X className="w-4 h-4" /> Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Queue Info */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-violet-500" />
              Waiting Queue
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-6 rounded-xl border border-border bg-background/50 flex flex-col justify-center items-center text-center">
                <div className="text-4xl font-extrabold text-foreground">{waitingCount}</div>
                <div className="text-sm text-muted-foreground mt-2">Customers in Queue</div>
              </div>

              <div className="p-6 rounded-xl border border-border bg-background/50 flex flex-col justify-center items-center text-center">
                <div className="text-sm font-semibold text-muted-foreground">Queue Mode</div>
                <div className="text-lg font-bold text-foreground mt-2">First In, First Out</div>
                <div className="text-xs text-emerald-500 mt-1">Automatic Routing Enabled</div>
              </div>
            </div>
          </div>
        </div>

        {/* History / Call Log Sidebar */}
        <div className="p-6 rounded-2xl bg-card border border-border space-y-4 flex flex-col h-[500px]">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <History className="w-5 h-5 text-violet-500" />
            Recent Calls Log
          </h2>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {callHistory.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">No call history recorded.</div>
            ) : (
              callHistory.map((call) => (
                <div
                  key={call.id}
                  className="p-3.5 rounded-xl border border-border bg-background/50 hover:bg-background transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-foreground truncate max-w-[120px]">
                      {call.visitorName}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        call.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-zinc-500/10 text-zinc-400'
                      }`}
                    >
                      {call.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {call.durationSeconds ? `${Math.round(call.durationSeconds / 60)}m ${call.durationSeconds % 60}s` : '0s'}
                    </span>
                    <span>{new Date(call.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Outbound Call Modal */}
      {showOutboundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 bg-card border border-border rounded-2xl shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Video className="w-5 h-5 text-violet-500" />
                Initialize Outbound Call
              </h3>
              <button
                onClick={() => setShowOutboundModal(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartOutbound} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={outboundName}
                  onChange={(e) => setOutboundName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Customer Email *</label>
                <input
                  type="email"
                  required
                  placeholder="john@example.com"
                  value={outboundEmail}
                  onChange={(e) => setOutboundEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowOutboundModal(false)}
                  className="flex-1 py-2.5 border border-border rounded-lg text-sm font-semibold hover:bg-muted text-foreground transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !outboundName.trim() || !outboundEmail.trim()}
                  className="flex-1 py-2.5 rounded-lg text-white font-semibold text-sm gradient-primary hover:opacity-95 disabled:opacity-50 transition-all"
                >
                  {loading ? 'Sending Invite...' : 'Launch Call'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

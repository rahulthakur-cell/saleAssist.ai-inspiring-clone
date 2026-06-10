'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  ParticipantTile,
  useMaybeRoomContext,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { Copy, PhoneOff, Save, User, Mail, Phone, FileText, VideoOff, Mic, MicOff, Video, VideoOff as VideoIconOff, Monitor, Maximize, Minimize } from 'lucide-react';
import { toast } from 'sonner';
import { videoCallApi } from '@/lib/api-client';

function CallControlsInner() {
  const room = useMaybeRoomContext();
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [sharing, setSharing] = useState(false);

  const toggleMic = async () => {
    if (!room) return;
    const participant = room.localParticipant as any;
    await participant.setMicrophoneEnabled(!micOn);
    setMicOn((prev) => !prev);
  };

  const toggleCamera = async () => {
    if (!room) return;
    const participant = room.localParticipant as any;
    await participant.setCameraEnabled(!cameraOn);
    setCameraOn((prev) => !prev);
  };

  const toggleScreenShare = async () => {
    if (!room) return;
    const participant = room.localParticipant as any;
    try {
      if (sharing) {
        await participant.stopScreenShare();
        setSharing(false);
        toast.info('Screen share stopped');
      } else {
        await participant.publishScreen();
        setSharing(true);
        toast.success('Screen sharing started');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to toggle screen share');
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-black/70 backdrop-blur-md border border-border/50 px-4 py-2.5 rounded-full">
      <button
        onClick={toggleMic}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-border hover:border-zinc-700 text-white text-xs font-semibold"
      >
        {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-rose-500" />}
        {micOn ? 'Mute' : 'Unmute'}
      </button>
      <button
        onClick={toggleCamera}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-border hover:border-zinc-700 text-white text-xs font-semibold"
      >
        {cameraOn ? <Video className="w-4 h-4" /> : <VideoIconOff className="w-4 h-4 text-rose-500" />}
        {cameraOn ? 'Stop Video' : 'Start Video'}
      </button>
      <button
        onClick={toggleScreenShare}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-border hover:border-zinc-700 text-white text-xs font-semibold"
      >
        <Monitor className="w-4 h-4" />
        {sharing ? 'Stop Share' : 'Share Screen'}
      </button>
    </div>
  );
}

export default function VideoCallRoomPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.callId as string;

  const [token, setToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveKitUrl, setLiveKitUrl] = useState<string | null>(null);
  const [liveKitConfigError, setLiveKitConfigError] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isEndingCallRef = useRef(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const resolvedLiveKitUrl = liveKitUrl || process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || 'ws://localhost:7880';

  useEffect(() => {
    if (callId) {
      loadLiveKitConfig();
    }
  }, [callId]);

  useEffect(() => {
    if (callId && resolvedLiveKitUrl && !token) {
      joinCallRoom();
    }
  }, [callId, resolvedLiveKitUrl, token]);

  const loadLiveKitConfig = async () => {
    try {
      const config = await videoCallApi.getConfig();
      if (config?.liveKitUrl) {
        setLiveKitUrl(config.liveKitUrl);
        setLiveKitConfigError('');
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to load LiveKit config';
      setLiveKitConfigError(message);
      console.error('[LiveKit] Config load failed:', message);
    }
  };

  const joinCallRoom = async () => {
    try {
      setLoading(true);
      const profileStr = localStorage.getItem('user');
      let agentName = 'Agent';
      if (profileStr) {
        try {
          const profile = JSON.parse(profileStr);
          agentName = profile.name || 'Agent';
        } catch {}
      }

      const res = await videoCallApi.join(callId, agentName);
      setToken(res.token);
      setRoomName(res.roomName);
      setIsHost(Boolean(localStorage.getItem('user')));

      const callDetails = await videoCallApi.get(callId);
      if (callDetails) {
        setVisitorName(callDetails.visitorName || '');
        setVisitorEmail(callDetails.visitorEmail || '');
        setVisitorPhone(callDetails.visitorPhone || '');
        const tenantId = localStorage.getItem('tenantId');
        if (tenantId) {
          setInviteUrl(`${window.location.origin}/join-call/${callId}?tenantId=${tenantId}`);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect to video call');
      router.push('/video-calls');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteUrl) return;

    await navigator.clipboard.writeText(inviteUrl);
    toast.success('Invite link copied');
  };

  const handleEndCall = async () => {
    isEndingCallRef.current = true;
    try {
      await videoCallApi.end(callId);
      toast.success('Call ended successfully');
    } catch (err: any) {
      console.warn('Failed to end call session on server', err.message);
    } finally {
      router.push('/video-calls');
    }
  };

  const handleRoomDisconnected = () => {
    if (isEndingCallRef.current) {
      return;
    }

    toast.warning('Media connection dropped. The call was not ended.');
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    const el = videoContainerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to toggle fullscreen');
    }
  };

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNotes(true);
    try {
      await videoCallApi.update(callId, {
        visitorName,
        visitorEmail,
        visitorPhone,
        metadata: { notes },
      });
      toast.success('CRM Details updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Connecting to WebRTC media server...</p>
      </div>
    );
  }

  if (!token || !roomName) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <p className="text-rose-500 font-semibold">Could not establish media session.</p>
        <button
          onClick={() => router.push('/video-calls')}
          className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm text-foreground font-semibold"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] overflow-hidden">
      {/* LiveKit Video Feed */}
      <div ref={videoContainerRef} className="flex-1 flex flex-col rounded-2xl border border-border bg-zinc-950 overflow-hidden relative group">
        <LiveKitRoom
          video={true}
          audio={true}
          token={token}
          serverUrl={resolvedLiveKitUrl}
          data-lk-theme="default"
          onConnected={() => {
            console.log('[LiveKit] Connected to room:', roomName);
          }}
          onDisconnected={handleRoomDisconnected}
          onError={(err) => {
            console.error('[LiveKit] Connection error:', err);
            const message =
              typeof err === 'string'
                ? err
                : err instanceof Error
                  ? err.message
                  : JSON.stringify(err);
            toast.error(
              `Video connection failed: ${message}. Verify NEXT_PUBLIC_LIVEKIT_WS_URL is set and LiveKit is reachable.`,
            );
          }}
          className="flex-1 flex flex-col"
        >
          <VideoLayout />
          <RoomAudioRenderer />
          <div style={{ display: isHost ? 'flex' : 'none' }}>
            <CallControlsInner />
          </div>

          {/* Top-right controls */}
          <div className="absolute top-4 right-4 z-40 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/70 backdrop-blur-sm border border-border/50 text-white text-xs font-semibold hover:bg-black/80 transition-all"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              {isFullscreen ? 'Exit' : 'Fullscreen'}
            </button>
            <button
              onClick={handleEndCall}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/25 transition-all"
            >
              <PhoneOff className="w-4 h-4" /> End Call
            </button>
          </div>
        </LiveKitRoom>
      </div>

      {/* CRM Lead Notes Panel */}
      <div className="w-full lg:w-96 rounded-2xl border border-border bg-card p-6 flex flex-col gap-6 overflow-y-auto">
        <div>
          <h2 className="text-lg font-bold text-foreground">CRM & Call Notes</h2>
          <p className="text-xs text-muted-foreground mt-1">Capture lead metrics and contact details directly into CRM.</p>
        </div>

        {inviteUrl && (
          <div className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Customer Invite Link</div>
            <div className="flex gap-2">
              <input
                value={inviteUrl}
                readOnly
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground"
              />
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="shrink-0 rounded-lg border border-border px-3 text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Copy invite link"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveNotes} className="flex-1 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            {/* Contact details */}
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Client Name
                </label>
                <input
                  type="text"
                  placeholder="Visitor Name"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Client Email
                </label>
                <input
                  type="email"
                  placeholder="visitor@example.com"
                  value={visitorEmail}
                  onChange={(e) => setVisitorEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Client Phone
                </label>
                <input
                  type="text"
                  placeholder="+1 (555) 000-0000"
                  value={visitorPhone}
                  onChange={(e) => setVisitorPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {/* Note text field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Call Consultation Notes
              </label>
              <textarea
                placeholder="Type call details, customer pain points, budget, next steps..."
                rows={6}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="submit"
              disabled={savingNotes}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold text-sm shadow-md shadow-violet-500/10 transition-all"
            >
              <Save className="w-4 h-4" />
              {savingNotes ? 'Saving Notes...' : 'Save CRM Details'}
            </button>
            
            <button
              type="button"
              onClick={handleEndCall}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/30 hover:bg-red-500/10 text-red-500 font-semibold text-sm transition-all"
            >
              <PhoneOff className="w-4 h-4" />
              Terminate Call
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VideoLayout() {
  const tracks = useTracks([Track.Source.Camera]);

  const localTracks = tracks.filter((track) => track.participant.isLocal);
  const remoteTracks = tracks.filter((track) => !track.participant.isLocal);

  const hasNoVideo = localTracks.length === 0 && remoteTracks.length === 0;

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      {hasNoVideo ? (
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center">
            <VideoOff className="w-10 h-10 text-zinc-500" />
          </div>
          <div>
            <p className="text-zinc-400 font-medium">Waiting for video...</p>
            <p className="text-zinc-500 text-sm mt-1">Please allow camera access to see your video</p>
          </div>
        </div>
      ) : (
        <div className={`grid gap-4 w-full h-full ${remoteTracks.length > 1 ? 'grid-cols-2' : remoteTracks.length === 1 ? 'grid-cols-1 max-w-4xl' : 'grid-cols-1 max-w-2xl'}`}>
          {/* Local video (your camera) - always shown first */}
          {localTracks.map((trackRef) => (
            <div key={trackRef.participant.identity} className="relative rounded-xl overflow-hidden bg-zinc-900">
              <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-violet-600/90 text-white text-xs font-semibold">
                You
              </div>
              <ParticipantTile trackRef={trackRef} />
            </div>
          ))}
          {/* Remote videos */}
          {remoteTracks.map((trackRef) => (
            <div key={trackRef.participant.identity} className="relative rounded-xl overflow-hidden bg-zinc-900">
              <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-zinc-700/90 text-white text-xs font-semibold">
                {trackRef.participant.name || trackRef.participant.identity}
              </div>
              <ParticipantTile trackRef={trackRef} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

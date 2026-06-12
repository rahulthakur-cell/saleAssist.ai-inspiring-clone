'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  ParticipantTile,
  useLocalParticipant,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { PhoneCall, VideoOff, Mic, MicOff, Video, LayoutGrid, MessageSquare, X, Send } from 'lucide-react';
import { toast } from 'sonner';
import { videoCallApi } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';

type CallControlsInnerProps = {
  onToggleChat: () => void;
  isGuest?: boolean;
};

function CallControlsInner({
  onToggleChat,
  isGuest,
}: CallControlsInnerProps) {
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();

  const toggleMic = async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to toggle microphone');
    }
  };

  const toggleCamera = async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to toggle camera');
    }
  };

  const toggleScreenShare = async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
      if (!isScreenShareEnabled) {
        toast.success('Screen sharing started');
      } else {
        toast.info('Screen share stopped');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to toggle screen share');
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-transparent/70 backdrop-blur-md border border-border/50 px-4 py-2.5 rounded-full">
      <button
        onClick={toggleMic}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-border hover:border-zinc-700 text-white text-xs font-semibold"
      >
        {isMicrophoneEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-rose-500" />}
        {isMicrophoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
      </button>
      <button
        onClick={toggleCamera}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-border hover:border-zinc-700 text-white text-xs font-semibold"
      >
        {isCameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4 text-rose-500" />}
        {isCameraEnabled ? 'Stop Camera' : 'Start Camera'}
      </button>
      <button
        onClick={toggleScreenShare}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${isScreenShareEnabled ? 'bg-violet-600 border-violet-500 text-white' : 'bg-zinc-900 border-border hover:border-zinc-700 text-white'}`}
      >
        <LayoutGrid className="w-4 h-4" />
        {isScreenShareEnabled ? 'Stop Share' : 'Share Screen'}
      </button>
      <button onClick={onToggleChat} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-border hover:border-zinc-700 text-white text-xs font-semibold">
        <MessageSquare className="w-4 h-4" /> Chat
      </button>
    </div>
  );
}

function CustomerJoinCallInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const callId = params.callId as string;
  const tenantId = searchParams.get('tenantId') || undefined;

  const [name, setName] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [liveKitUrl, setLiveKitUrl] = useState<string | null>(null);
  const [liveKitConfigError, setLiveKitConfigError] = useState('');

  // Chat states
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: string; senderName: string; text: string; createdAt: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const chatSocketRef = useRef<any>(null);

  const resolvedLiveKitUrl = liveKitUrl || process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || 'ws://localhost:7880';

  useEffect(() => {
    const storedName = sessionStorage.getItem('saleassist-visitor-name');
    if (storedName) {
      setName(storedName);
    }
  }, []);

  useEffect(() => {
    loadLiveKitConfig();
  }, []);

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
      console.error('[LiveKit] Guest config load failed:', message);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError('');
    setIsJoining(true);
    try {
      sessionStorage.setItem('saleassist-visitor-name', name.trim());
      const result = await videoCallApi.join(callId, name.trim(), tenantId);
      if (tenantId) {
        localStorage.setItem('tenantId', tenantId);
      }
      setToken(result.token);
      setRoomName(result.roomName);
    } catch (err: any) {
      setError(err.message || 'Could not join this video call.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleChatToggle = () => {
    console.log('[Guest Chat] handleChatToggle clicked', { next: !showChat });
    const next = !showChat;
    setShowChat(next);
    if (!next) {
      chatSocketRef.current?.disconnect();
      chatSocketRef.current = null;
      return;
    }
    try {
      const socket = getSocket('/video', { tenantId });
      chatSocketRef.current = socket;
      socket.on('connect', () => socket.emit('call:join', { callId }));
      socket.on('call:chat:message', (payload: any) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, { id: payload.id, senderName: payload.senderName, text: payload.message || payload.text, createdAt: payload.createdAt }];
        });
      });
      socket.connect();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to join chat');
      setShowChat(false);
    }
  };

  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!text) return;
    try {
      const saved = await videoCallApi.sendChatMessage(callId, { message: text, senderName: name || 'Guest' });
      setMessages((prev) => {
        if (prev.some((m) => m.id === saved.id)) return prev;
        return [...prev, { id: saved.id, senderName: saved.senderName, text: saved.message, createdAt: saved.createdAt }];
      });
      setChatInput('');
    } catch (err: any) {
      console.error('[Guest Chat] Send message failed:', err);
      toast.error(err?.message || 'Failed to send message');
    }
  };

  useEffect(() => {
    return () => {
      if (chatSocketRef.current) chatSocketRef.current.disconnect();
    };
  }, []);

  if (token && roomName) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white relative">
        <LiveKitRoom
          video
          audio
          token={token}
          serverUrl={resolvedLiveKitUrl}
          data-lk-theme="default"
          onConnected={() => {
            console.log('[LiveKit] Guest connected to room:', roomName);
          }}
          onDisconnected={() => {
            console.warn('[LiveKit] Guest disconnected from room:', roomName);
          }}
          onError={(err) => {
            const message =
              typeof err === 'string'
                ? err
                : err instanceof Error
                  ? err.message
                  : JSON.stringify(err);
            if (message.includes('Client initiated disconnect')) {
              console.debug('[LiveKit] Client initiated disconnect');
              return;
            }
            console.error('[LiveKit] Guest connection error:', err);
            toast.error(
              `Video connection failed: ${message}. Verify NEXT_PUBLIC_LIVEKIT_WS_URL is set and LiveKit is reachable.`,
            );
          }}
          className="min-h-screen flex flex-col"
        >
          <VideoLayout name={name} />
          <RoomAudioRenderer />
          
          <CallControlsInner
            onToggleChat={handleChatToggle}
            isGuest={true}
          />

          {showChat && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="text-white text-sm font-semibold">Call Chat</span>
                <button onClick={() => setShowChat(false)} className="text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((item) => (
                  <div key={item.id} className="max-w-[80%] rounded-2xl bg-white/10 px-3 py-2 text-white">
                    <div className="text-[10px] text-white/60">{item.senderName}</div>
                    <div className="text-sm">{item.text}</div>
                  </div>
                ))}
                {messages.length === 0 && <div className="text-xs text-white/70">No messages yet.</div>}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-3 border-t border-white/10">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message..." className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/60" />
                <button type="submit" disabled={!chatInput.trim()} className="mt-2 w-full py-2 rounded-lg bg-violet-600 disabled:opacity-50 text-white text-sm font-semibold">Send</button>
              </form>
            </div>
          )}
        </LiveKitRoom>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <form
        onSubmit={handleJoin}
        className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-6 space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Join Video Call</h1>
            <p className="text-sm text-zinc-400">Enter your name to enter the call room.</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-zinc-300">
            Your name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-500"
            placeholder="Enter your name"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isJoining || !name.trim()}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {isJoining ? 'Joining...' : 'Join Call'}
        </button>
      </form>
    </main>
  );
}

export default function CustomerJoinCallPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
      </div>
    }>
      <CustomerJoinCallInner />
    </Suspense>
  );
}

function VideoLayout({ name }: { name: string }) {
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
          {localTracks.map((trackRef) => (
            <div key={trackRef.participant.identity} className="relative rounded-xl overflow-hidden bg-zinc-900">
              <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-violet-600/90 text-white text-xs font-semibold">
                {name || 'You'}
              </div>
              <ParticipantTile trackRef={trackRef} />
            </div>
          ))}
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

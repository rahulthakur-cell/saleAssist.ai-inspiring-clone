'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  ParticipantTile,
  useLocalParticipant,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import {
   Copy,
   PhoneOff,
   Save,
   User,
   Mail,
   Phone,
   FileText,
   VideoOff,
   Mic,
   MicOff,
   Video,
   Maximize,
   Minimize,
   MessageSquare,
   Send,
   X,
   LayoutGrid,
   Link2,
   Hand,
   Smile,
 } from 'lucide-react';
import { toast } from 'sonner';
import { videoCallApi } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';

function normalizeLiveKitUrl(url: string) {
  if (url.startsWith('http://')) return url.replace(/^http:\/\//, 'ws://');
  if (url.startsWith('https://')) return url.replace(/^https:\/\//, 'wss://');
  return url;
}

function useLocalTracks() {
  const tracks = useTracks([
    Track.Source.Camera,
    Track.Source.ScreenShare,
    Track.Source.Microphone,
  ]);
  const localAudio = tracks.find(
    (t) => t.participant.isLocal && t.source === Track.Source.Microphone,
  );
  const localVideo = tracks.find((t) => t.participant.isLocal && t.source === Track.Source.Camera);
  const localScreen = tracks.find(
    (t) => t.participant.isLocal && t.source === Track.Source.ScreenShare,
  );

  const getTrackEnabled = (ref: any) => {
    if (!ref) return false;
    const pub = ref.publication;
    if (pub?.isEnabled !== undefined) return pub.isEnabled;
    const track = ref.track;
    if (track?.isEnabled !== undefined) return track.isEnabled;
    return false;
  };

  const micOn = getTrackEnabled(localAudio);
  const cameraOn = getTrackEnabled(localVideo);
  const sharing = Boolean(localScreen);

  return { micOn, cameraOn, sharing };
}

type CallControlsInnerProps = {
   onToggleRecording: () => void;
   onToggleChat: () => void;
   isRecording: boolean;
   recordingSeconds: number;
   formatTime: (s: number) => string;
   onShareCallLink: () => void;
   inviteUrl?: string;
   onRaiseHand?: () => void;
   onSendReaction?: (emoji: string) => void;
   isHandRaised?: boolean;
 };

function CallControlsInner({
   onToggleRecording,
   onToggleChat,
   isRecording,
   recordingSeconds,
   formatTime,
   onShareCallLink,
   inviteUrl,
   onRaiseHand,
   onSendReaction,
   isHandRaised,
 }: CallControlsInnerProps) {
   const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
     useLocalParticipant();
   const [showReactions, setShowReactions] = useState(false);

  const toggleMic = async () => {
    console.log('[Controls] toggleMic clicked', {
      isMicrophoneEnabled,
      hasParticipant: Boolean(localParticipant),
    });
    if (!localParticipant) return;
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to toggle microphone');
    }
  };

  const toggleCamera = async () => {
    console.log('[Controls] toggleCamera clicked', {
      isCameraEnabled,
      hasParticipant: Boolean(localParticipant),
    });
    if (!localParticipant) return;
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to toggle camera');
    }
  };

  const toggleScreenShare = async () => {
    console.log('[Controls] toggleScreenShare clicked', {
      isScreenShareEnabled,
      hasParticipant: Boolean(localParticipant),
    });
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
    <>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-transparent/70 backdrop-blur-md border border-border/50 px-4 py-2.5 rounded-full">
        <button
          onClick={toggleMic}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-border hover:border-zinc-700 text-white text-xs font-semibold"
        >
          {isMicrophoneEnabled ? (
            <Mic className="w-4 h-4" />
          ) : (
            <MicOff className="w-4 h-4 text-rose-500" />
          )}
          {isMicrophoneEnabled ? 'Mute ' : 'Unmute'}
        </button>
        <button
          onClick={toggleCamera}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-border hover:border-zinc-700 text-white text-xs font-semibold"
        >
          {isCameraEnabled ? (
            <Video className="w-4 h-4" />
          ) : (
            <VideoOff className="w-4 h-4 text-rose-500" />
          )}
          {isCameraEnabled ? 'Stop Camera' : 'Start Camera'}
        </button>
        <button
          onClick={toggleScreenShare}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${isScreenShareEnabled ? 'bg-violet-600 border-violet-500 text-white' : 'bg-zinc-900 border-border hover:border-zinc-700 text-white'}`}
        >
          <LayoutGrid className="w-4 h-4" />
          {isScreenShareEnabled ? 'Stop Share' : 'Share Screen'}
        </button>
        <button
          onClick={onToggleRecording}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${isRecording ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-900 border-border hover:border-zinc-700 text-white'}`}
        >
          {isRecording ? 'Stop Rec' : 'Record'}
        </button>
        {isRecording && (
          <span className="text-xs font-mono text-white/90">{formatTime(recordingSeconds)}</span>
        )}
        <button
          onClick={onToggleChat}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-border hover:border-zinc-700 text-white text-xs font-semibold"
        >
          <MessageSquare className="w-4 h-4" /> Chat
        </button>
        <button
          onClick={onRaiseHand}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${isHandRaised ? 'bg-amber-500 border-amber-400 text-white' : 'bg-zinc-900 border-border hover:border-zinc-700 text-white'}`}
          title="Raise hand"
        >
          <Hand className="w-4 h-4" />
        </button>
        <div className="relative">
          <button
            onClick={() => setShowReactions(!showReactions)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-border hover:border-zinc-700 text-white text-xs font-semibold"
            title="Reactions"
          >
            <Smile className="w-4 h-4" />
          </button>
{showReactions && (
             <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/80 backdrop-blur-md border border-border/50 px-2 py-1.5 rounded-full">
               <button onClick={() => { onSendReaction?.('👍'); setShowReactions(false); }} className="p-1 hover:scale-125 transition-transform" title="Thumbs up">👍</button>
               <button onClick={() => { onSendReaction?.('❤️'); setShowReactions(false); }} className="p-1 hover:scale-125 transition-transform" title="Heart">❤️</button>
               <button onClick={() => { onSendReaction?.('😂'); setShowReactions(false); }} className="p-1 hover:scale-125 transition-transform" title="Laugh">😂</button>
             </div>
           )}
        </div>
      </div>
      {inviteUrl && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-black/70 backdrop-blur-md border border-border/50 px-3 py-2 rounded-full">
          <Link2 className="w-4 h-4 text-white/80" />
          <input
            readOnly
            value={inviteUrl}
            className="bg-transparent text-white text-xs w-72 outline-none"
          />
          <button
            type="button"
            onClick={onShareCallLink}
            className="text-white text-xs font-semibold hover:text-white/80"
          >
            Copy
          </button>
        </div>
      )}
    </>
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ id: string; senderName: string; text: string; createdAt: string }>
  >([]);
  const [chatInput, setChatInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const isEndingCallRef = useRef(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const chatSocketRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  const resolvedLiveKitUrl = normalizeLiveKitUrl(
    liveKitUrl || process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || 'ws://localhost:7880',
  );

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

  const onShareCallLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('Call link copied');
    } catch {
      toast.error('Failed to copy link');
    }
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

  const toggleFullscreen = async () => {
    const el = videoContainerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to toggle fullscreen');
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleRecordingToggle = async () => {
    console.log('[Controls] handleRecordingToggle clicked', { isRecording });
    if (!isRecording) {
      try {
        const result = await videoCallApi.startRecording(callId);
        if (result?.fallbackToScreen) {
          console.log('[Controls] Falling back to screen recording');
          toast('Server recording unavailable, using browser screen recording');
          
          // Use display media to capture the user's screen
          try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ 
              video: { displaySurface: 'window' }, 
              audio: true 
            });
            const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
              ? 'video/webm;codecs=vp9'
              : MediaRecorder.isTypeSupported('video/webm')
                ? 'video/webm'
                : '';
            
            if (!mime) {
              toast.error('MediaRecorder not supported in this browser');
              stream.getTracks().forEach(t => t.stop());
              return;
            }
            
            const recorder = new MediaRecorder(stream, { mimeType: mime });
            const chunks: Blob[] = [];
            
            recorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunks.push(e.data);
            };
            
            recorder.onstop = async () => {
              const blob = new Blob(chunks, { type: mime });
              const objectUrl = URL.createObjectURL(blob);
              try {
                await videoCallApi.uploadRecording(callId, {
                  url: objectUrl,
                  sizeBytes: blob.size,
                  durationSec: recordingSeconds,
                  mimeType: mime,
                });
                toast.success('Recording saved');
              } catch {
                toast.error('Failed to save recording');
              }
              stream.getTracks().forEach((t) => t.stop());
              URL.revokeObjectURL(objectUrl);
            };
            
            recorder.start(1000);
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            toast.success('Recording started - select the video call window/tab');
          } catch (err: any) {
            if (err?.name === 'NotAllowedError') {
              toast.error('Screen recording permission denied');
            } else {
              toast.error('Could not start screen recording: ' + (err?.message || 'Unknown error'));
            }
          }
        } else if (result?.recordingId) {
          setRecordingId(result.recordingId);
          setIsRecording(true);
          toast.success('Room recording started');
        } else {
          toast.error('Recording failed - no response from server');
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to start recording');
      }
    } else {
      try {
        if (recordingId) {
          await videoCallApi.stopRecording(callId, recordingId);
        }
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        setRecordingId(null);
        toast.info('Recording stopped');
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        setRecordingSeconds(0);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to stop recording');
      }
    }
  };

  useEffect(() => {
    if (!isRecording) setRecordingSeconds(0);
  }, [isRecording]);

  useEffect(() => {
    let interval: number | undefined;
    if (isRecording) interval = window.setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isRecording]);

const formatTime = (seconds: number) => {
     const mins = Math.floor(seconds / 60);
     const secs = seconds % 60;
     return `${mins}:${secs.toString().padStart(2, '0')}`;
   };

   const [isHandRaised, setIsHandRaised] = useState(false);
   const reactionSocketRef = useRef<any>(null);

   const handleRaiseHand = async () => {
     try {
       if (!reactionSocketRef.current) {
         reactionSocketRef.current = getSocket('/video', {
           tenantId: localStorage.getItem('tenantId') || undefined,
         });
         reactionSocketRef.current.connect();
       }
       reactionSocketRef.current.emit('call:reaction', {
         callId,
         emoji: 'raise_hand',
         participantName: 'You',
       });
       setIsHandRaised(!isHandRaised);
       toast.success(isHandRaised ? 'Hand lowered' : 'Hand raised');
     } catch (err: any) {
       toast.error(err?.message || 'Failed to raise hand');
     }
   };

   const handleSendReaction = (emoji: string) => {
     try {
       if (!reactionSocketRef.current) {
         reactionSocketRef.current = getSocket('/video', {
           tenantId: localStorage.getItem('tenantId') || undefined,
         });
         reactionSocketRef.current.connect();
       }
       reactionSocketRef.current.emit('call:reaction', {
         callId,
         emoji,
         participantName: 'You',
       });
     } catch (err: any) {
       // Silent fail for reactions
     }
   };

   const handleChatToggle = () => {
    console.log('[Controls] handleChatToggle clicked', { next: !showChat });
    const next = !showChat;
    setShowChat(next);
    if (!next) {
      chatSocketRef.current?.disconnect();
      chatSocketRef.current = null;
      return;
    }
    try {
      const socket = getSocket('/video', {
        tenantId: localStorage.getItem('tenantId') || undefined,
      });
      chatSocketRef.current = socket;
      socket.on('connect', () => socket.emit('call:join', { callId }));
      socket.on('call:chat:message', (payload: any) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [
            ...prev,
            {
              id: payload.id,
              senderName: payload.senderName,
              text: payload.message || payload.text,
              createdAt: payload.createdAt,
            },
          ];
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
      const profileStr = localStorage.getItem('user');
      let senderName = 'Agent';
      if (profileStr) {
        try {
          const profile = JSON.parse(profileStr);
          senderName = profile.name || 'Agent';
        } catch {}
      }
      const saved = await videoCallApi.sendChatMessage(callId, { message: text, senderName });
      setMessages((prev) => {
        if (prev.some((m) => m.id === saved.id)) return prev;
        return [
          ...prev,
          {
            id: saved.id,
            senderName: saved.senderName,
            text: saved.message,
            createdAt: saved.createdAt,
          },
        ];
      });
      setChatInput('');
    } catch (err: any) {
      console.error('[Chat] Send message failed:', err);
      toast.error(err?.message || 'Failed to send message');
    }
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      if (chatSocketRef.current) chatSocketRef.current.disconnect();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">
          Connecting to WebRTC media server...
        </p>
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
      <div
        ref={videoContainerRef}
        className="flex-1 flex flex-col rounded-2xl border border-border bg-zinc-950 overflow-hidden relative group"
      >
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
            console.error('[LiveKit] Connection error:', err);
            toast.error(
              `Video connection failed: ${message}. Verify NEXT_PUBLIC_LIVEKIT_WS_URL is set and LiveKit is reachable.`,
            );
          }}
          className="flex-1 flex flex-col"
        >
          <VideoLayout />
          <RoomAudioRenderer />

          <CallControlsInner
            onToggleRecording={handleRecordingToggle}
            onToggleChat={handleChatToggle}
            isRecording={isRecording}
            recordingSeconds={recordingSeconds}
            formatTime={formatTime}
            onShareCallLink={onShareCallLink}
            inviteUrl={inviteUrl}
            onRaiseHand={handleRaiseHand}
            onSendReaction={handleSendReaction}
            isHandRaised={isHandRaised}
          />

          {/* Top-right controls */}
          <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
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

        {showChat && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-white text-sm font-semibold">Call Chat</span>
              <button onClick={() => setShowChat(false)} className="text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((item) => (
                <div
                  key={item.id}
                  className="max-w-[80%] rounded-2xl bg-white/10 px-3 py-2 text-white"
                >
                  <div className="text-[10px] text-white/60">{item.senderName}</div>
                  <div className="text-sm">{item.text}</div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="text-xs text-white/70">No messages yet.</div>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 border-t border-white/10"
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/60"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="mt-2 w-full py-2 rounded-lg bg-violet-600 disabled:opacity-50 text-white text-sm font-semibold"
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>

      {/* CRM Lead Notes Panel */}
      <div className="w-full lg:w-96 rounded-2xl border border-border bg-card p-6 flex flex-col gap-6 overflow-y-auto">
        <div>
          <h2 className="text-lg font-bold text-foreground">CRM & Call Notes</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Capture lead metrics and contact details directly into CRM.
          </p>
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
   const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);

   const localScreen = tracks.find(
     (t) => t.participant.isLocal && t.source === Track.Source.ScreenShare,
   );
   const localCameras = tracks.filter(
     (t) => t.participant.isLocal && t.source === Track.Source.Camera,
   );
   const localCamera = localCameras[0];

   // Get all remote screen shares
   const remoteScreens = tracks.filter(
     (t) => !t.participant.isLocal && t.source === Track.Source.ScreenShare,
   );

// Get all unique remote participant identities (from camera OR screen share)
    const allRemoteParticipants = Array.from(
      new Set(
        tracks
          .filter((t) => !t.participant.isLocal && (t.source === Track.Source.Camera || t.source === Track.Source.ScreenShare))
          .map((t) => t.participant.identity),
      ),
    );

const anyoneScreenSharing = Boolean(
      localScreen || remoteScreens.length > 0,
    );

    // Get the primary screen share (first remote or local)
    const screenTrackRef = localScreen || (remoteScreens.length > 0 ? remoteScreens[0] : undefined);
    const screenParticipantName = screenTrackRef?.participant?.name || screenTrackRef?.participant?.identity || 'Screen';

    // Track which identity is shown in main screen area to avoid duplicates
    const mainScreenIdentity = screenTrackRef?.participant?.identity;

    // Get camera track for a participant
    const getCameraTrack = (participantIdentity: string) => {
      return tracks.find(
        (t) =>
          !t.participant.isLocal &&
          t.participant.identity === participantIdentity &&
          t.source === Track.Source.Camera,
      );
    };

    const visibleParticipantIds: Array<string | 'local'> = [
      ...allRemoteParticipants,
      ...(localCamera ? ['local'] : []),
    ];

    // Get additional screen shares (not the primary one, for small tiles)
    const additionalScreenShares = remoteScreens.filter(
      (t) => t.participant.identity !== mainScreenIdentity,
    );

return (
       <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center">
              <VideoOff className="w-10 h-10 text-zinc-500" />
            </div>
            <div>
              <p className="text-zinc-400 font-medium">Waiting for video...</p>
              <p className="text-zinc-500 text-sm mt-1">
                Please allow camera access to see your video
              </p>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 w-full h-full">
            {anyoneScreenSharing && screenTrackRef && (
              <div className="flex-1 rounded-xl overflow-hidden bg-zinc-900 relative">
                <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-violet-600/90 text-white text-xs font-semibold">
                  {localScreen ? 'You (Screen)' : `${screenParticipantName} (Screen)`}
                </div>
                <ParticipantTile trackRef={screenTrackRef} className="w-full h-full" />
              </div>
            )}
            <div
              className={`${anyoneScreenSharing ? 'flex flex-col gap-3' : 'grid gap-4 w-full h-full max-w-4xl grid-cols-1 md:grid-cols-2'}`}
            >
              {visibleParticipantIds.map((identityOrLocal) => {
                const participantId = identityOrLocal === 'local' ? undefined : identityOrLocal;
                const isLocal = identityOrLocal === 'local';
                const cameraRef = isLocal
                  ? localCamera
                  : participantId
                    ? getCameraTrack(participantId)
                    : null;

                // If no camera, check if they have a screen share to show as fallback
                const screenRef = !isLocal && participantId && !cameraRef
                  ? tracks.find((t) => !t.participant.isLocal && t.participant.identity === participantId && t.source === Track.Source.ScreenShare)
                  : null;

                // Skip screen-only in grid if they're the main screen sharer (already shown large)
                if (mainScreenIdentity && participantId === mainScreenIdentity && screenRef && !cameraRef) return null;

                // Skip if no camera and no screen at all
                if (!cameraRef && !screenRef) return null;

                // Use whichever is available - camera takes precedence in grid
                const displayRef = cameraRef ?? screenRef;
                const participant = displayRef!.participant;
                const isShowingScreenAsVideo = screenRef && !cameraRef;

                return (
                  <div
                    key={participant.identity + (isShowingScreenAsVideo ? '-screen' : '')}
                    className="relative rounded-xl overflow-hidden bg-zinc-900"
                    style={
                      !anyoneScreenSharing ? { width: '100%' } : { width: '180px', height: '120px' }
                    }
                  >
                    <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-violet-600/90 text-white text-xs font-semibold">
                      {participant.isLocal ? 'You' : (participant.name || participant.identity) + (isShowingScreenAsVideo ? ' (Screen)' : '')}
                    </div>
                    <ParticipantTile
                      trackRef={displayRef as any}
                      style={
                        !anyoneScreenSharing
                          ? {}
                          : { width: '100%', height: '100%', objectFit: 'cover' }
                      }
                    />
                  </div>
                );
              })}
              {/* Show additional screen shares as small tiles (when multiple people screen sharing) */}
              {anyoneScreenSharing && additionalScreenShares.map((screen) => (
                <div
                  key={screen.participant.identity + '-additional-screen'}
                  className="relative rounded-xl overflow-hidden bg-zinc-900"
                  style={{ width: '180px', height: '120px' }}
                >
                  <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-violet-600/90 text-white text-xs font-semibold">
                    {(screen.participant.name || screen.participant.identity) + ' (Screen)'}
                  </div>
                  <ParticipantTile trackRef={screen as any} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

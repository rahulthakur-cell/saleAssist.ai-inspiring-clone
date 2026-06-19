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
import {
   PhoneCall,
   VideoOff,
   Mic,
   MicOff,
   Video,
   LayoutGrid,
   MessageSquare,
   X,
   Send,
   Hand,
   Smile,
   Save,
   Paperclip,
   Camera,
   } from 'lucide-react';
import { toast } from 'sonner';
import { videoCallApi } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';

function normalizeLiveKitUrl(url: string) {
  if (url.startsWith('http://')) return url.replace(/^http:\/\//, 'ws://');
  if (url.startsWith('https://')) return url.replace(/^https:\/\//, 'wss://');
  return url;
}

type CallControlsInnerProps = {
  onToggleChat: () => void;
  onSendReaction?: (emoji: string) => void;
  onRaiseHand?: () => void;
  isGuest?: boolean;
  isHandRaised?: boolean;
  onToggleRecording?: () => void;
  isRecording?: boolean;
  recordingSeconds?: number;
  formatTime?: (s: number) => string;
};

function CallControlsInner({ onToggleChat, onSendReaction, onRaiseHand, isGuest, isHandRaised, onToggleRecording, isRecording, recordingSeconds, formatTime }: CallControlsInnerProps) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();
  const [showReactions, setShowReactions] = useState(false);

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
        {isMicrophoneEnabled ? (
          <Mic className="w-4 h-4" />
        ) : (
          <MicOff className="w-4 h-4 text-rose-500" />
        )}
        {isMicrophoneEnabled ? 'Mute ' : 'Unmute '}
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
      {isRecording && recordingSeconds !== undefined && formatTime && (
        <span className="text-xs font-mono text-white/90">{formatTime(recordingSeconds)}</span>
      )}
      <button
        onClick={onToggleChat}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-border hover:border-zinc-700 text-white text-xs font-semibold"
      >
        <MessageSquare className="w-4 h-4" /> Chat
      </button>
      {isGuest && onRaiseHand && (
        <button
          onClick={onRaiseHand}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${isHandRaised ? 'bg-amber-500 border-amber-400 text-white' : 'bg-zinc-900 border-border hover:border-zinc-700 text-white'}`}
          title="Raise hand"
        >
          <Hand className="w-4 h-4" />
        </button>
      )}
      {isGuest && onSendReaction && (
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
              <button onClick={() => { onSendReaction('👍'); setShowReactions(false); }} className="p-1 hover:scale-125 transition-transform" title="Thumbs up">👍</button>
              <button onClick={() => { onSendReaction('❤️'); setShowReactions(false); }} className="p-1 hover:scale-125 transition-transform" title="Heart">❤️</button>
              <button onClick={() => { onSendReaction('😂'); setShowReactions(false); }} className="p-1 hover:scale-125 transition-transform" title="Laugh">😂</button>
              <button onClick={() => { onSendReaction('raise_hand'); setShowReactions(false); }} className="p-1 hover:scale-125 transition-transform" title="Raise hand">✋</button>
            </div>
          )}
        </div>
      )}


    </div>
  );
}

function CustomerJoinCallInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const callId = params.callId as string;
  const tenantId = searchParams.get('tenantId') || undefined;

  const [name, setName] = useState('');
  const [token, setToken] = useState < string | null > (null);
  const [roomName, setRoomName] = useState < string | null > (null);
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [liveKitUrl, setLiveKitUrl] = useState < string | null > (null);
  const [liveKitConfigError, setLiveKitConfigError] = useState('');

// Chat states
   const [showChat, setShowChat] = useState(false);
   const [messages, setMessages] = useState <
     Array < { id: string; senderName: string; text: string; createdAt: string; attachmentUrl?: string; attachmentType?: string; attachmentName?: string } >
   > ([]);
   const [chatInput, setChatInput] = useState('');
   const chatSocketRef = useRef < any > (null);
   const fileInputRef = useRef < HTMLInputElement > (null);

  const resolvedLiveKitUrl = normalizeLiveKitUrl(
    liveKitUrl || process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || 'ws://localhost:7880',
  );

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

  const handleChatToggle = async () => {
    console.log('[Guest Chat] handleChatToggle clicked', { next: !showChat });
    const next = !showChat;
    setShowChat(next);
    if (!next) {
      chatSocketRef.current?.disconnect();
      chatSocketRef.current = null;
      return;
    }
    try {
      const history = await videoCallApi.getChatHistory(callId, tenantId);
      if (history) {
        setMessages(
          history.map((m: any) => ({
            id: m.id,
            senderName: m.senderName,
            text: m.message || m.text,
            createdAt: m.createdAt,
            attachmentUrl: m.attachmentUrl,
            attachmentType: m.attachmentType,
            attachmentName: m.attachmentName,
          })),
        );
      }
    } catch (err) {
      console.error('[Guest Chat] Failed to load chat history:', err);
    }
    try {
      const socket = getSocket('/video', { tenantId });
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
               attachmentUrl: payload.attachmentUrl,
               attachmentType: payload.attachmentType,
               attachmentName: payload.attachmentName,
             },
           ];
         });
       });
      socket.on('call:reaction', (payload: any) => {
        handleReactionReceived({ emoji: payload.emoji, participantName: payload.participantName });
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
      const saved = await videoCallApi.sendChatMessage(callId, {
        message: text,
        senderName: name || 'Guest',
      });
      setMessages((prev) => {
        if (prev.some((m) => m.id === saved.id)) return prev;
        return [
          ...prev,
          {
            id: saved.id,
            senderName: saved.senderName,
            text: saved.message,
            createdAt: saved.createdAt,
            attachmentUrl: saved.attachmentUrl,
            attachmentType: saved.attachmentType,
            attachmentName: saved.attachmentName,
          },
        ];
      });
      setChatInput('');
    } catch (err: any) {
      console.error('[Guest Chat] Send message failed:', err);
      toast.error(err?.message || 'Failed to send message');
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const { presignedUrl, publicUrl } = await videoCallApi.getChatUploadUrl(callId, {
        fileName: file.name,
        fileType: file.type,
      }, tenantId);

      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file');
      }

      const saved = await videoCallApi.sendChatMessage(callId, {
        message: file.name,
        senderName: name || 'Guest',
        attachmentUrl: publicUrl,
        attachmentType: file.type,
        attachmentName: file.name,
      });
      setMessages((prev) => {
        if (prev.some((m) => m.id === saved.id)) return prev;
        return [
          ...prev,
          {
            id: saved.id,
            senderName: saved.senderName,
            text: saved.message,
            createdAt: saved.createdAt,
            attachmentUrl: saved.attachmentUrl,
            attachmentType: saved.attachmentType,
            attachmentName: saved.attachmentName,
          },
        ];
      });
      toast.success('File attached successfully');
    } catch (err: any) {
      console.error('[Guest Chat] File upload failed:', err);
      toast.error(err?.message || 'Failed to upload file');
    }
  };

  const handleScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'screen' },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      const imageBlob = await new Promise<Blob>((resolve) => {
        const canvas = document.createElement('canvas');
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        video.onloadedmetadata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext('2d')?.drawImage(video, 0, 0);
          canvas.toBlob((blob) => {
            stream.getTracks().forEach((t) => t.stop());
            if (blob) resolve(blob);
          }, 'image/png');
        };
      });

      const file = new File([imageBlob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
      await handleFileUpload(file);
    } catch (err: any) {
      if (err?.name !== 'NotAllowedError') {
        toast.error(err?.message || 'Failed to capture screenshot');
      }
    }
  };

  const reactionSocketRef = useRef < any > (null);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [reactions, setReactions] = useState < Array < { id: string; emoji: string; participantName: string; timestamp: number } >> ([]);
  const reactionsTimeoutRef = useRef < any > (null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef < MediaRecorder | null > (null);
  const recordingTimerRef = useRef < any > (null);

  const handleRaiseHand = async () => {
    try {
      if (!reactionSocketRef.current) {
        reactionSocketRef.current = getSocket('/video', { tenantId });
        reactionSocketRef.current.connect();
      }
      reactionSocketRef.current.emit('call:reaction', {
        callId,
        emoji: 'raise_hand',
        participantName: name || 'Guest',
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
        reactionSocketRef.current = getSocket('/video', { tenantId });
        reactionSocketRef.current.connect();
      }
      reactionSocketRef.current.emit('call:reaction', {
        callId,
        emoji,
        participantName: name || 'Guest',
      });
    } catch (err: any) {
      // Silent fail for reactions
    }
  };

  const handleReactionReceived = (payload: { emoji: string; participantName: string }) => {
    const reactionId = `${payload.emoji}-${Date.now()}`;
    setReactions(prev => [...prev, { id: reactionId, emoji: payload.emoji, participantName: payload.participantName, timestamp: Date.now() }]);

    if (reactionsTimeoutRef.current) clearTimeout(reactionsTimeoutRef.current);
    reactionsTimeoutRef.current = setTimeout(() => {
      setReactions([]);
    }, 3000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRecordingToggle = async () => {
    if (!isRecording) {
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
          
          try {
            // Get presigned URL from backend
            const { presignedUrl } = await videoCallApi.uploadRecording(callId, {
              sizeBytes: blob.size,
              durationSec: recordingSeconds,
              mimeType: mime,
            });
            
            // Upload blob directly to MinIO
            const uploadRes = await fetch(presignedUrl, {
              method: 'PUT',
              headers: { 'Content-Type': mime },
              body: blob,
            });
            
            if (!uploadRes.ok) {
              throw new Error('Failed to upload to storage');
            }
            
            toast.success('Recording saved successfully to MinIO');
          } catch (err: any) {
            toast.error('Failed to save recording: ' + (err?.message || 'Unknown error'));
          }
          
          stream.getTracks().forEach((t) => t.stop());
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
    } else {
      try {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        toast.info('Recording stopped');
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        setRecordingSeconds(0);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to stop recording');
      }
    }
  };

  useEffect(() => {
    let interval: number | undefined;
    if (isRecording) interval = window.setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (chatSocketRef.current) chatSocketRef.current.disconnect();
      if (reactionSocketRef.current) reactionSocketRef.current.disconnect();
      if (reactionsTimeoutRef.current) clearTimeout(reactionsTimeoutRef.current);
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
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
            if (message.includes('Requested device not found') || message.includes('NotFoundError')) {
              toast.warning('Camera or microphone not found. You may join as audio-only or view-only.');
              console.warn('[LiveKit] Device not found:', err);
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
            onSendReaction={handleSendReaction}
            onRaiseHand={handleRaiseHand}
            onToggleRecording={handleRecordingToggle}
            isGuest={true}
            isHandRaised={isHandRaised}
            isRecording={isRecording}
            recordingSeconds={recordingSeconds}
            formatTime={formatTime}
          />

          {/* Reaction overlay */}
          {reactions.length > 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex items-center justify-center gap-4 pointer-events-none">
              {reactions.map((r) => (
                <div key={r.id} className="text-6xl md:text-7xl animate-bounce">
                  {r.emoji === 'raise_hand' ? '✋' : r.emoji}
                </div>
              ))}
            </div>
          )}

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
                     {item.attachmentUrl ? (
                       item.attachmentType?.startsWith('image/') ? (
                         <img
                           src={item.attachmentUrl}
                           alt={item.attachmentName || 'Attachment'}
                           className="max-w-full max-h-48 rounded-lg mt-1"
                         />
                       ) : (
                         <a
                           href={item.attachmentUrl}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="text-violet-400 text-sm underline mt-1 block"
                         >
                           {item.attachmentName || item.text}
                         </a>
                       )
                     ) : (
                       <div className="text-sm">{item.text}</div>
                     )}
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
                 ref={fileInputRef}
                 type="file"
                 accept="image/*,application/pdf,.doc,.docx,.txt,.csv"
                 onChange={(e) => {
                   const file = e.target.files?.[0];
                   if (file) handleFileUpload(file);
                   e.target.value = '';
                 }}
                 className="hidden"
               />
               <div className="flex gap-2">
                 <button
                   type="button"
                   onClick={() => fileInputRef.current?.click()}
                   className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-semibold hover:bg-white/20"
                   title="Attach file"
                 >
                   <Paperclip className="w-4 h-4" />
                 </button>
                 <button
                   type="button"
                   onClick={handleScreenshot}
                   className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-semibold hover:bg-white/20"
                   title="Take screenshot"
                 >
                   <Camera className="w-4 h-4" />
                 </button>
               </div>
               <div className="flex gap-2 mt-2">
                 <input
                   value={chatInput}
                   onChange={(e) => setChatInput(e.target.value)}
                   placeholder="Type a message..."
                   className="flex-1 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/60"
                 />
                 <button
                   type="submit"
                   disabled={!chatInput.trim()}
                   className="px-4 py-2 rounded-lg bg-violet-600 disabled:opacity-50 text-white text-sm font-semibold"
                 >
                   Send
                 </button>
               </div>
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
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
        </div>
      }
    >
      <CustomerJoinCallInner />
    </Suspense>
  );
}

function VideoLayout({ name }: { name: string }) {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);

  const localCamera = tracks.find((track) => track.participant.isLocal && track.source === Track.Source.Camera);
  const localScreen = tracks.find((track) => track.participant.isLocal && track.source === Track.Source.ScreenShare);
  const remoteScreens = tracks.filter((track) => !track.participant.isLocal && track.source === Track.Source.ScreenShare);
  const remoteCameras = tracks.filter((track) => !track.participant.isLocal && track.source === Track.Source.Camera);
  const primaryScreen = remoteScreens[0] ?? localScreen;
  const anyoneSharingScreen = Boolean(primaryScreen);
  const hasRemoteVideo = remoteCameras.length > 0 || remoteScreens.length > 0;

  const remoteParticipantIdentities = Array.from(
    new Set([
      ...remoteScreens.map((t) => t.participant.identity),
      ...remoteCameras.map((t) => t.participant.identity),
    ]),
  );

  type Thumbnail = { participant: any; trackRef: any; isScreen: boolean };
  const thumbnails: Thumbnail[] = remoteParticipantIdentities
    .map((participantIdentity) => {
      const screenRef = remoteScreens.find((t) => t.participant.identity === participantIdentity);
      const cameraRef = remoteCameras.find((t) => t.participant.identity === participantIdentity);
      const isPrimaryScreenParticipant = screenRef && primaryScreen?.participant.identity === screenRef.participant.identity;

      if (isPrimaryScreenParticipant) return null;

      const displayRef = screenRef ?? cameraRef;
      if (!displayRef) return null;

      return {
        participant: displayRef.participant,
        trackRef: displayRef,
        isScreen: Boolean(screenRef),
      };
    })
    .filter((thumbnail): thumbnail is Thumbnail => Boolean(thumbnail));

  if (localCamera && !localScreen) {
    thumbnails.push({ participant: localCamera.participant, trackRef: localCamera, isScreen: false });
  }

  if (localScreen && primaryScreen?.participant.identity !== localScreen.participant.identity) {
    thumbnails.push({ participant: localScreen.participant, trackRef: localScreen, isScreen: true });
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      {!hasRemoteVideo && !localScreen ? (
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
      ) : anyoneSharingScreen ? (
        <div className="flex flex-col lg:flex-row gap-4 w-full h-full">
          <div className="flex-1 rounded-xl overflow-hidden bg-zinc-900 relative min-h-0">
            <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-violet-600/90 text-white text-xs font-semibold">
              {primaryScreen?.participant.isLocal ? 'You (Screen)' : (primaryScreen?.participant?.name || primaryScreen?.participant?.identity || 'Agent') + ' (Screen)'}
            </div>
            <ParticipantTile trackRef={primaryScreen} className="w-full h-full" />
          </div>
          <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto lg:w-52">
            {thumbnails.map(({ participant, trackRef, isScreen }) => (
              <div
                key={`${participant.identity}-${trackRef.source}`}
                className="relative rounded-xl overflow-hidden bg-zinc-900 aspect-video lg:aspect-[16/9] flex-shrink-0 lg:w-full"
                style={{ maxWidth: '200px', maxHeight: '150px' }}
              >
                <div className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded bg-violet-600/90 text-white text-[10px] font-semibold">
                  {participant.isLocal ? (name || 'You') : (participant.name || participant.identity)}
                  {isScreen ? ' (Screen)' : ''}
                </div>
                <ParticipantTile
                  trackRef={trackRef as any}
                  style={{ width: '100%', height: '100%', objectFit: isScreen ? 'contain' : 'cover' }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 w-full h-full max-w-6xl grid-cols-1 md:grid-cols-2">
          {localCamera && (
            <div className="relative rounded-xl overflow-hidden bg-zinc-900">
              <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-violet-600/90 text-white text-xs font-semibold">
                {name || 'You'}
              </div>
              <ParticipantTile trackRef={localCamera} />
            </div>
          )}
          {remoteCameras.map((trackRef) => (
            <div
              key={trackRef.participant.identity}
              className="relative rounded-xl overflow-hidden bg-zinc-900"
            >
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

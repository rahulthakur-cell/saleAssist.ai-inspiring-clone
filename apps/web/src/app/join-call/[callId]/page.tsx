'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  ParticipantTile,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { PhoneCall, VideoOff } from 'lucide-react';
import { toast } from 'sonner';
import { videoCallApi } from '@/lib/api-client';

export default function CustomerJoinCallPage() {
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
      setToken(result.token);
      setRoomName(result.roomName);
    } catch (err: any) {
      setError(err.message || 'Could not join this video call.');
    } finally {
      setIsJoining(false);
    }
  };

  if (token && roomName) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
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
            console.error('[LiveKit] Guest connection error:', err);
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
          className="min-h-screen"
        >
          <VideoLayout name={name} />
          <RoomAudioRenderer />
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

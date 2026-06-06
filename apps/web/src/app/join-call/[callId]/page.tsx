'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { PhoneCall } from 'lucide-react';
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

  useEffect(() => {
    const storedName = sessionStorage.getItem('saleassist-visitor-name');
    if (storedName) {
      setName(storedName);
    }
  }, []);

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
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || 'ws://localhost:7880'}
          data-lk-theme="default"
          className="min-h-screen"
        >
          <VideoConference />
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

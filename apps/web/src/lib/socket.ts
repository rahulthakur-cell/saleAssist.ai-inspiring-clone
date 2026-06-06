import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

export function getSocket(namespace: '/video' | '/stream', options: { tenantId?: string } = {}): Socket {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const tenantId =
    options.tenantId ||
    (typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null);

  const socket = io(`${SOCKET_URL}${namespace}`, {
    auth: {
      token: token || undefined,
    },
    query: {
      tenantId: tenantId || '',
    },
    transports: ['websocket', 'polling'],
    autoConnect: false,
  });

  return socket;
}

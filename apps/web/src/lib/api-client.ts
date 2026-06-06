const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
  skipAuthRefresh?: boolean;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  timestamp: string;
}

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errors?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

function unwrapApiResponse<T>(result: unknown): T {
  if (
    result &&
    typeof result === 'object' &&
    'success' in result &&
    'data' in result
  ) {
    return (result as ApiResponse<T>).data;
  }

  return result as T;
}

function clearStoredAuth() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('tenantId');
}

async function refreshAccessToken(): Promise<AuthTokens | null> {
  if (typeof window === 'undefined') return null;

  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearStoredAuth();
    return null;
  }

  const result = unwrapApiResponse<AuthTokens>(await response.json());
  if (!result?.accessToken || !result.refreshToken) {
    clearStoredAuth();
    return null;
  }

  localStorage.setItem('accessToken', result.accessToken);
  localStorage.setItem('refreshToken', result.refreshToken);
  return result;
}

async function apiClient<T = unknown>(
  endpoint: string,
  options: ApiOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers = {}, token, skipAuthRefresh = false } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Add auth token
  const storedToken = token || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
  if (storedToken) {
    requestHeaders['Authorization'] = `Bearer ${storedToken}`;
  }

  // Add tenant ID
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
  if (tenantId) {
    requestHeaders['X-Tenant-ID'] = tenantId;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !skipAuthRefresh && typeof window !== 'undefined') {
    const refreshedTokens = await refreshAccessToken();
    if (refreshedTokens) {
      return apiClient<T>(endpoint, {
        ...options,
        token: refreshedTokens.accessToken,
        skipAuthRefresh: true,
      });
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorBody.message || `API Error: ${response.statusText}`,
      errorBody.errors,
    );
  }

  return unwrapApiResponse<T>(await response.json());
}

// ─── Auth API ─────────────────────────────────────────

export const authApi = {
  register: (data: { email: string; password: string; name: string; tenantName: string }) =>
    apiClient('/auth/register', { method: 'POST', body: data }),

  login: (data: { email: string; password: string; tenantSlug?: string }) =>
    apiClient<{
      user: any;
      tokens: { accessToken: string; refreshToken: string; expiresIn: number };
    }>('/auth/login', { method: 'POST', body: data }),

  refresh: (refreshToken: string) =>
    apiClient<AuthTokens>('/auth/refresh', { method: 'POST', body: { refreshToken }, skipAuthRefresh: true }),

  logout: (refreshToken: string) =>
    apiClient('/auth/logout', { method: 'POST', body: { refreshToken } }),

  me: () => apiClient('/auth/me'),
};

// ─── Tenant API ───────────────────────────────────────

export const tenantApi = {
  getCurrent: () => apiClient('/tenants/current'),
  update: (data: any) => apiClient('/tenants/current', { method: 'PATCH', body: data }),
  getUsage: () => apiClient('/tenants/current/usage'),
};

// ─── Team API ─────────────────────────────────────────

export const teamApi = {
  listMembers: () => apiClient('/team/members'),
  invite: (data: { email: string; role: string }) =>
    apiClient('/team/invite', { method: 'POST', body: data }),
  removeMember: (id: string) => apiClient(`/team/members/${id}`, { method: 'DELETE' }),
  updateRole: (id: string, data: { role: string }) =>
    apiClient(`/team/members/${id}/role`, { method: 'PATCH', body: data }),
};

// ─── User API ─────────────────────────────────────────

export const userApi = {
  getProfile: () => apiClient('/users/profile'),
  updateProfile: (data: any) => apiClient('/users/profile', { method: 'PATCH', body: data }),
  getTenants: () => apiClient('/users/tenants'),
};

// ─── Video Call API ───────────────────────────────────

export const videoCallApi = {
  create: (
    data: { type?: string; visitorName?: string; visitorEmail?: string; visitorPhone?: string },
    tenantId?: string,
  ) =>
    apiClient<any>('/video-calls', {
      method: 'POST',
      body: data,
      headers: tenantId ? { 'X-Tenant-ID': tenantId } : undefined,
    }),
  join: (callId: string, participantName: string, tenantId?: string) =>
    apiClient<{ token: string; roomName: string; callId: string; status: string }>(`/video-calls/${callId}/join`, {
      method: 'POST',
      body: { participantName },
      headers: tenantId ? { 'X-Tenant-ID': tenantId } : undefined,
    }),
  end: (callId: string) =>
    apiClient(`/video-calls/${callId}/end`, { method: 'POST' }),
  update: (
    callId: string,
    data: {
      visitorName?: string;
      visitorEmail?: string;
      visitorPhone?: string;
      metadata?: Record<string, unknown>;
    },
  ) =>
    apiClient<any>(`/video-calls/${callId}`, { method: 'PATCH', body: data }),
  get: (callId: string) => apiClient<any>(`/video-calls/${callId}`),
  list: (limit = 20, page = 1) => apiClient<any>(`/video-calls?limit=${limit}&page=${page}`),
  getQueue: () => apiClient<{ waitingCount: number }>('/video-calls/queue'),
};

// ─── Live Stream API ───────────────────────────────────

export const liveStreamApi = {
  create: (data: { title: string; description?: string; scheduledAt?: string; isShoppable?: boolean }) =>
    apiClient<any>('/live-streams', { method: 'POST', body: data }),
  start: (streamId: string) =>
    apiClient<any>(`/live-streams/${streamId}/start`, { method: 'POST' }),
  end: (streamId: string) =>
    apiClient<any>(`/live-streams/${streamId}/end`, { method: 'POST' }),
  join: (streamId: string, participantName: string) =>
    apiClient<{ token: string; roomName: string; isHost: boolean; identity: string }>(`/live-streams/${streamId}/join`, {
      method: 'POST',
      body: { participantName },
    }),
  addProduct: (streamId: string, data: { productName: string; productUrl: string; productImage?: string; price?: number }) =>
    apiClient<any>(`/live-streams/${streamId}/products`, { method: 'POST', body: data }),
  removeProduct: (streamId: string, productId: string) =>
    apiClient<any>(`/live-streams/${streamId}/products/${productId}`, { method: 'DELETE' }),
  featureProduct: (streamId: string, productId: string) =>
    apiClient<any>(`/live-streams/${streamId}/feature/${productId}`, { method: 'POST' }),
  get: (streamId: string) => apiClient<any>(`/live-streams/${streamId}`),
  list: (limit = 20, page = 1) => apiClient<any>(`/live-streams?limit=${limit}&page=${page}`),
};

// ─── Storage API ───────────────────────────────────────

export const storageApi = {
  getPresignedUrl: (fileName: string, contentType: string) =>
    apiClient<{ uploadUrl: string; publicUrl: string; objectName: string }>('/storage/presigned-url', {
      method: 'POST',
      body: { fileName, contentType },
    }),
};

// ─── Shoppable Video API ───────────────────────────────

export const shoppableVideoApi = {
  create: (data: { title: string; description?: string; videoUrl: string; displayType?: string }) =>
    apiClient<any>('/shoppable-videos', { method: 'POST', body: data }),
  update: (id: string, data: any) =>
    apiClient<any>(`/shoppable-videos/${id}`, { method: 'PATCH', body: data }),
  get: (id: string) => apiClient<any>(`/shoppable-videos/${id}`),
  list: (limit = 20, page = 1) => apiClient<any>(`/shoppable-videos?limit=${limit}&page=${page}`),
  delete: (id: string) => apiClient<any>(`/shoppable-videos/${id}`, { method: 'DELETE' }),
  addHotspot: (
    id: string,
    data: {
      productName: string;
      productUrl: string;
      productImage?: string;
      price?: number;
      startTime: number;
      endTime: number;
      posX?: number;
      posY?: number;
    },
  ) =>
    apiClient<any>(`/shoppable-videos/${id}/hotspots`, { method: 'POST', body: data }),
  deleteHotspot: (id: string, hotspotId: string) =>
    apiClient<any>(`/shoppable-videos/${id}/hotspots/${hotspotId}`, { method: 'DELETE' }),
};

// ─── Video FAQ API ─────────────────────────────────────

export const videoFaqApi = {
  create: (data: { title: string; description?: string }) =>
    apiClient<any>('/video-faqs', { method: 'POST', body: data }),
  addItem: (faqId: string, data: { question: string; videoUrl: string }) =>
    apiClient<any>(`/video-faqs/${faqId}/items`, { method: 'POST', body: data }),
  list: () => apiClient<any>('/video-faqs'),
  delete: (id: string) => apiClient<any>(`/video-faqs/${id}`, { method: 'DELETE' }),
  deleteItem: (faqId: string, itemId: string) =>
    apiClient<any>(`/video-faqs/${faqId}/items/${itemId}`, { method: 'DELETE' }),
};

// ─── AI Chat API ───────────────────────────────────────

export const aiChatApi = {
  createSession: (data?: { title?: string }) =>
    apiClient<any>('/ai-chat/sessions', { method: 'POST', body: data || {} }),
  listSessions: () => apiClient<any[]>('/ai-chat/sessions'),
  getSession: (id: string) => apiClient<any>(`/ai-chat/sessions/${id}`),
};

// ─── Widget API ────────────────────────────────────────

export const widgetApi = {
  getConfig: (tenantId?: string) =>
    apiClient<any>(`/widget/config${tenantId ? `?tenantId=${tenantId}` : ''}`),
  updateConfig: (data: any) =>
    apiClient<any>('/widget/config', { method: 'PATCH', body: data }),
};

// ─── Analytics API ─────────────────────────────────────

export const analyticsApi = {
  trackEvent: (data: {
    fingerprint: string;
    type: string;
    page?: string;
    referrer?: string;
    duration?: number;
    metadata?: any;
    tenantId?: string;
    visitorInfo?: any;
  }) =>
    apiClient<any>('/analytics/events', {
      method: 'POST',
      body: data,
    }),
  getOverview: () => apiClient<any>('/analytics/overview'),
  getVisitors: (limit?: number) =>
    apiClient<any>(`/analytics/visitors${limit ? `?limit=${limit}` : ''}`),
};

// ─── Billing API ───────────────────────────────────────

export const billingApi = {
  getSubscription: () => apiClient<any>('/billing/subscription'),
  upgradePlan: (plan: string) =>
    apiClient<any>('/billing/upgrade', { method: 'POST', body: { plan } }),
  getInvoices: () => apiClient<any[]>('/billing/invoices'),
};

// ─── Search API ────────────────────────────────────────

export const searchApi = {
  query: (q: string) =>
    apiClient<any[]>(`/search?q=${encodeURIComponent(q)}`),
  reindex: () =>
    apiClient<any>('/search/reindex', { method: 'POST' }),
};

export { apiClient, ApiError };
export default apiClient;

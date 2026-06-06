import { create } from 'zustand';
import { authApi } from '@/lib/api-client';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  isSuperAdmin: boolean;
  currentTenant?: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    role: string;
  };
  tenants?: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
  }>;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; tenantName: string }) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

interface AuthResult {
  user: AuthUser;
  tenant?: AuthUser['currentTenant'];
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

function assertAuthResult(result: unknown): asserts result is AuthResult {
  const authResult = result as Partial<AuthResult> | undefined;

  if (
    !authResult?.user ||
    !authResult.tokens?.accessToken ||
    !authResult.tokens?.refreshToken
  ) {
    throw new Error('Invalid login response from server. Please try again.');
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const result = await authApi.login({ email, password });
    assertAuthResult(result);
    localStorage.setItem('accessToken', result.tokens.accessToken);
    localStorage.setItem('refreshToken', result.tokens.refreshToken);
    if (result.user.currentTenant) {
      localStorage.setItem('tenantId', result.user.currentTenant.id);
    }
    set({ user: result.user, isAuthenticated: true, isLoading: false });
  },

  register: async (data) => {
    const result = await authApi.register(data);
    assertAuthResult(result);
    localStorage.setItem('accessToken', result.tokens.accessToken);
    localStorage.setItem('refreshToken', result.tokens.refreshToken);
    if (result.tenant) {
      localStorage.setItem('tenantId', result.tenant.id);
    }
    set({
      user: {
        ...result.user,
        currentTenant: result.tenant,
      },
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Ignore logout errors
      }
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tenantId');
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const user: any = await authApi.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('tenantId');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),
}));

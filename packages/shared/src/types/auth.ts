// ============================================================
// Auth Types
// ============================================================

export interface JwtPayload {
  sub: string; // userId
  email: string;
  tenantId?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantSlug?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  tenantName: string;
  tenantSlug?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface AuthUser {
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
}

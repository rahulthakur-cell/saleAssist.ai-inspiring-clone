// ============================================================
// Tenant Types
// ============================================================

export interface TenantSettings {
  timezone: string;
  currency: string;
  language: string;
  brandColor?: string;
  logoUrl?: string;
  customDomain?: string;
}

export interface TenantUsage {
  videoMinutesUsed: number;
  videoMinutesLimit: number;
  storageUsedGb: number;
  storageLimitGb: number;
  agentsUsed: number;
  agentsLimit: number;
  aiTokensUsed: number;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  logo?: string | null;
}

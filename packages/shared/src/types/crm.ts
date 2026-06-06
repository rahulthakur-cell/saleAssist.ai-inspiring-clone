// ============================================================
// CRM Types
// ============================================================

export interface ContactSummary {
  id: string;
  email?: string | null;
  phone?: string | null;
  firstName: string;
  lastName?: string | null;
  avatar?: string | null;
  title?: string | null;
  companyName?: string | null;
  source?: string | null;
  tags: string[];
  createdAt: string;
}

export interface CompanySummary {
  id: string;
  name: string;
  domain?: string | null;
  industry?: string | null;
  size?: string | null;
  logo?: string | null;
  contactCount: number;
  dealCount: number;
}

export interface DealSummary {
  id: string;
  title: string;
  value?: number | null;
  currency: string;
  stage: string;
  probability?: number | null;
  ownerName?: string | null;
  companyName?: string | null;
  expectedCloseAt?: string | null;
}

export interface LeadSummary {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  status: string;
  source: string;
  score: number;
  assignedToName?: string | null;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  contactName?: string | null;
  dealTitle?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

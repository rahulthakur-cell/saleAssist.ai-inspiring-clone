// ============================================================
// Billing Types
// ============================================================

export interface PlanInfo {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    agents: number;
    monthlyMinutes: number;
    storageGb: number;
    aiTokens: number;
  };
  isPopular?: boolean;
}

export interface SubscriptionInfo {
  id: string;
  planId: string;
  planName: string;
  status: string;
  provider: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface InvoiceInfo {
  id: string;
  amount: number;
  currency: string;
  status: string;
  pdfUrl?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export const PLANS: PlanInfo[] = [
  {
    id: 'free',
    name: 'Free',
    slug: 'free',
    price: 0,
    currency: 'USD',
    interval: 'month',
    features: [
      '2 agents',
      '100 video minutes/month',
      '5 GB storage',
      'Basic analytics',
      'Email support',
    ],
    limits: { agents: 2, monthlyMinutes: 100, storageGb: 5, aiTokens: 1000 },
  },
  {
    id: 'starter',
    name: 'Starter',
    slug: 'starter',
    price: 29,
    currency: 'USD',
    interval: 'month',
    features: [
      '5 agents',
      '500 video minutes/month',
      '25 GB storage',
      'Shoppable videos',
      'CRM basics',
      'Priority support',
    ],
    limits: { agents: 5, monthlyMinutes: 500, storageGb: 25, aiTokens: 10000 },
  },
  {
    id: 'professional',
    name: 'Professional',
    slug: 'professional',
    price: 99,
    currency: 'USD',
    interval: 'month',
    isPopular: true,
    features: [
      '25 agents',
      '2,000 video minutes/month',
      '100 GB storage',
      'Live streaming',
      'AI chat',
      'Full CRM',
      'Custom widget',
      'API access',
      'Priority support',
    ],
    limits: { agents: 25, monthlyMinutes: 2000, storageGb: 100, aiTokens: 100000 },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    slug: 'enterprise',
    price: 299,
    currency: 'USD',
    interval: 'month',
    features: [
      'Unlimited agents',
      'Unlimited video minutes',
      '1 TB storage',
      'Everything in Professional',
      'Custom domain',
      'SSO/SAML',
      'Dedicated support',
      'SLA guarantee',
    ],
    limits: { agents: 9999, monthlyMinutes: 99999, storageGb: 1000, aiTokens: 999999 },
  },
];

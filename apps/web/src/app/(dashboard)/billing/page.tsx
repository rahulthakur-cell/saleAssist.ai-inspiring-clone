'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { PLANS } from '@saleassist/shared';
import {
  CreditCard,
  CheckCircle2,
  TrendingUp,
  FileText,
  ShieldCheck,
  AlertCircle,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { billingApi } from '@/lib/api-client';

interface BillingLimits {
  maxAgents: number;
  maxMonthlyMinutes: number;
  maxStorageGb: number;
}

interface BillingUsage {
  agentsCount: number;
  minutesUsed: number;
  storageUsedGb: number;
}

interface SubscriptionDetails {
  id: string;
  externalId: string;
  status: string;
  planId: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

interface Invoice {
  id: string;
  externalId: string;
  amount: number;
  currency: string;
  status: string;
  pdfUrl?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  // States
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [limits, setLimits] = useState<BillingLimits | null>(null);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [sub, setSub] = useState<SubscriptionDetails | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    fetchBillingInfo();
  }, []);

  const fetchBillingInfo = async () => {
    try {
      const subRes = await billingApi.getSubscription();
      if (subRes) {
        setCurrentPlan(subRes.plan.toLowerCase());
        setLimits(subRes.limits);
        setUsage(subRes.usage);
        setSub(subRes.subscription);
      }

      const invRes = await billingApi.getInvoices();
      setInvoices(invRes || []);
    } catch {
      toast.error('Failed to load billing metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planSlug: string) => {
    if (planSlug === currentPlan) return;
    
    setUpgrading(true);
    try {
      await billingApi.upgradePlan(planSlug);
      toast.success(`Successfully upgraded to the ${planSlug.toUpperCase()} Plan! Usage limits updated.`);
      fetchBillingInfo();
    } catch (err: any) {
      toast.error(err.message || 'Checkout simulator failed');
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="w-8 h-8 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
      </div>
    );
  }

  // Calculate percentages
  const agentsPct = limits ? Math.min(Math.round((usage!.agentsCount / limits.maxAgents) * 100), 100) : 0;
  const minutesPct = limits ? Math.min(Math.round((usage!.minutesUsed / limits.maxMonthlyMinutes) * 100), 100) : 0;
  const storagePct = limits ? Math.min(Math.round((usage!.storageUsedGb / limits.maxStorageGb) * 100), 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-card border border-border flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-violet-500" />
            Billing & Metered Plans
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor limits consumption and trigger checkout upgrades via the payment simulator.
          </p>
        </div>
        
        <div className="flex items-center gap-1.5 text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg">
          <ShieldCheck className="w-4 h-4" />
          Secure Billing (Stripe Context)
        </div>
      </div>

      {/* Current Subscription Status */}
      <div className="rounded-2xl gradient-primary p-6 text-white shadow-xl shadow-indigo-500/15">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-white/70">Current Package tier</span>
            <div className="text-3xl font-extrabold capitalize mt-1">{currentPlan} Plan</div>
            <p className="text-xs text-white/70 mt-1.5 font-medium">
              Subscription Status: <span className="uppercase font-bold text-white font-sans">{sub?.status || 'ACTIVE'}</span> • 
              Renews {sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'Next Month'}
            </p>
          </div>
          <div className="text-right text-[11px] text-white/80 shrink-0 font-mono">
            Provider Token: {sub?.externalId || 'sub_mock_xxx'}
          </div>
        </div>
      </div>

      {/* Metered Usage Progress */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <TrendingUp className="w-4 h-4 text-violet-500" />
            Metered Usage Limits
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Your monthly boundaries relative to current package size</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Agent users limit */}
          <div className="space-y-2.5 p-4 bg-muted/20 border border-border rounded-xl">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-zinc-300">Active Agents</span>
              <span className="text-muted-foreground font-mono">
                {usage?.agentsCount} / {limits?.maxAgents === 9999 ? '∞' : limits?.maxAgents}
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-600 transition-all duration-300"
                style={{ width: `${limits?.maxAgents === 9999 ? 0 : agentsPct}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Team seats registered in your workspace</p>
          </div>

          {/* Video Minutes limit */}
          <div className="space-y-2.5 p-4 bg-muted/20 border border-border rounded-xl">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-zinc-300">Monthly Call Minutes</span>
              <span className="text-muted-foreground font-mono">
                {usage?.minutesUsed} / {limits?.maxMonthlyMinutes === 99999 ? '∞' : limits?.maxMonthlyMinutes}
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-600 transition-all duration-300"
                style={{ width: `${limits?.maxMonthlyMinutes === 99999 ? 0 : minutesPct}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Aggregated time in WebRTC call rooms</p>
          </div>

          {/* Storage limit */}
          <div className="space-y-2.5 p-4 bg-muted/20 border border-border rounded-xl">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-zinc-300">Uploaded File Storage</span>
              <span className="text-muted-foreground font-mono">
                {usage?.storageUsedGb} GB / {limits?.maxStorageGb === 1000 ? '1 TB' : `${limits?.maxStorageGb} GB`}
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-600 transition-all duration-300"
                style={{ width: `${limits?.maxStorageGb === 1000 ? 0 : storagePct}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Shoppable videos and media size in MinIO</p>
          </div>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <div
              key={plan.id}
              className={cn(
                'rounded-2xl border p-6 flex flex-col justify-between transition-all hover:shadow-lg',
                isCurrent
                  ? 'border-indigo-500 bg-indigo-500/5 shadow-md'
                  : 'border-border bg-card hover:border-indigo-500/30'
              )}
            >
              <div>
                {plan.isPopular && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full gradient-primary text-white mb-3 inline-block">
                    Most Popular
                  </span>
                )}
                <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-2.5">
                  <span className="text-3xl font-extrabold text-foreground">${plan.price}</span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                </div>
                
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrent || upgrading}
                className={cn(
                  'w-full mt-8 h-10 text-xs font-semibold rounded-xl transition-all',
                  isCurrent
                    ? 'bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-default'
                    : 'gradient-primary text-white hover:opacity-95 shadow-md disabled:opacity-50'
                )}
              >
                {isCurrent ? 'Active Plan' : plan.price === 0 ? 'Downgrade' : 'Upgrade Plan'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Invoices List */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <FileText className="w-4 h-4 text-violet-500" />
            Billing Invoice Receipts
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Recent billing actions logged in your dashboard</p>
        </div>

        {invoices.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <AlertCircle className="w-4.5 h-4.5" /> No invoices available yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs text-left">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                  <th className="py-3 px-2">Invoice Code</th>
                  <th className="py-3 px-2">Billing Date</th>
                  <th className="py-3 px-2">Total Amount</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">PDF File</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/60 hover:bg-muted/10 transition-colors">
                    <td className="py-3 px-2 font-mono text-zinc-300">{inv.externalId}</td>
                    <td className="py-3 px-2 text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2 font-semibold text-foreground">
                      ${parseFloat(inv.amount.toString()).toFixed(2)} USD
                    </td>
                    <td className="py-3 px-2">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full font-bold text-[9px] uppercase',
                        inv.status === 'SUCCEEDED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      )}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      {inv.pdfUrl && (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-violet-400 hover:underline hover:text-violet-300"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

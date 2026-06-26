'use client';

import { useState, useEffect, useCallback } from 'react';
import { dealApi, companyApi } from '@/lib/api-client';
import { cn, formatCurrency } from '@/lib/utils';

interface Deal {
  id: string;
  title: string;
  value?: string | number | null;
  currency: string;
  stage: string;
  probability?: number;
  expectedCloseAt?: string;
  createdAt: string;
  company?: { id: string; name: string } | null;
  owner?: { id: string; user: { name: string; email: string } } | null;
}

const STAGES = [
  { key: 'PROSPECTING', label: 'Prospecting', color: 'bg-blue-500', light: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  { key: 'QUALIFICATION', label: 'Qualification', color: 'bg-indigo-500', light: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  { key: 'PROPOSAL', label: 'Proposal', color: 'bg-violet-500', light: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  { key: 'NEGOTIATION', label: 'Negotiation', color: 'bg-amber-500', light: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { key: 'CLOSED_WON', label: 'Closed Won', color: 'bg-emerald-500', light: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { key: 'CLOSED_LOST', label: 'Closed Lost', color: 'bg-rose-500', light: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
];

export default function DealsPage() {
  const [byStage, setByStage] = useState<Record<string, Deal[]>>({
    PROSPECTING: [], QUALIFICATION: [], PROPOSAL: [], NEGOTIATION: [], CLOSED_WON: [], CLOSED_LOST: [],
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [form, setForm] = useState({ title: '', value: '', currency: 'USD', stage: 'PROSPECTING', probability: '', companyId: '', expectedCloseAt: '' });
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dealApi.list({ limit: 200 });
      setByStage(res?.byStage ?? { PROSPECTING: [], QUALIFICATION: [], PROPOSAL: [], NEGOTIATION: [], CLOSED_WON: [], CLOSED_LOST: [] });
      setTotal(res?.total ?? 0);
    } catch (err) {
      console.error('Failed to fetch deals', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await companyApi.list({ limit: 100 });
      setCompanies(res?.data ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchDeals(); fetchCompanies(); }, [fetchDeals, fetchCompanies]);

  const openCreate = (stage = 'PROSPECTING') => {
    setEditingDeal(null);
    setForm({ title: '', value: '', currency: 'USD', stage, probability: '', companyId: '', expectedCloseAt: '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (d: Deal) => {
    setEditingDeal(d);
    setForm({
      title: d.title,
      value: d.value != null ? String(d.value) : '',
      currency: d.currency,
      stage: d.stage,
      probability: d.probability != null ? String(d.probability) : '',
      companyId: d.company?.id ?? '',
      expectedCloseAt: d.expectedCloseAt ? d.expectedCloseAt.split('T')[0] : '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Deal title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title,
        value: form.value ? parseFloat(form.value) : undefined,
        currency: form.currency,
        stage: form.stage,
        probability: form.probability ? parseInt(form.probability) : undefined,
        companyId: form.companyId || undefined,
        expectedCloseAt: form.expectedCloseAt || undefined,
      };
      if (editingDeal) {
        await dealApi.update(editingDeal.id, payload);
      } else {
        await dealApi.create(payload);
      }
      setShowModal(false);
      fetchDeals();
    } catch (err: any) {
      setError(err?.message || 'Failed to save deal');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this deal?')) return;
    try { await dealApi.delete(id); fetchDeals(); } catch (err: any) { alert(err?.message || 'Failed to delete'); }
  };

  const handleStageChange = async (dealId: string, newStage: string) => {
    try {
      await dealApi.update(dealId, { stage: newStage });
      fetchDeals();
    } catch { /* silent */ }
  };

  const stageTotal = (stageKey: string) => {
    const deals = byStage[stageKey] ?? [];
    return deals.reduce((sum, d) => sum + (parseFloat(String(d.value ?? 0)) || 0), 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deals Pipeline</h1>
          <p className="text-muted-foreground mt-1">
            {total > 0 ? `${total} active deals` : 'Track deals across your sales pipeline stages.'}
          </p>
        </div>
        <button
          onClick={() => openCreate()}
          className="px-4 py-2.5 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          New Deal
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : (
        /* Kanban Board */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const deals = byStage[stage.key] ?? [];
            const total = stageTotal(stage.key);
            return (
              <div key={stage.key} className="flex-shrink-0 w-72">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={cn('w-2.5 h-2.5 rounded-full', stage.color)} />
                  <h3 className="text-sm font-semibold text-foreground flex-1">{stage.label}</h3>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{deals.length}</span>
                </div>
                {total > 0 && (
                  <p className="text-xs text-muted-foreground px-1 mb-2">{formatCurrency(total)}</p>
                )}
                <div className="space-y-2">
                  {deals.map((deal) => (
                    <div key={deal.id} className="rounded-xl border border-border bg-card p-3.5 hover:shadow-md hover:border-primary/30 transition-all group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold text-foreground line-clamp-2 flex-1">{deal.title}</div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => openEdit(deal)} className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </button>
                          <button onClick={() => handleDelete(deal.id)} className="p-1 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                          </button>
                        </div>
                      </div>
                      {deal.value != null && parseFloat(String(deal.value)) > 0 && (
                        <div className="mt-2 text-sm font-bold text-primary">{formatCurrency(parseFloat(String(deal.value)))}</div>
                      )}
                      {deal.company && (
                        <div className="mt-1 text-xs text-muted-foreground">{deal.company.name}</div>
                      )}
                      {deal.probability != null && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">Probability</span>
                            <span className="text-xs font-medium text-foreground">{deal.probability}%</span>
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all', stage.color)}
                              style={{ width: `${deal.probability}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {/* Stage quick-move */}
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <select
                          value={deal.stage}
                          onChange={e => handleStageChange(deal.id, e.target.value)}
                          className="w-full text-xs bg-transparent border-none text-muted-foreground focus:outline-none cursor-pointer"
                          onClick={e => e.stopPropagation()}
                        >
                          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => openCreate(stage.key)}
                    className="w-full py-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all"
                  >
                    + Add deal
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground">{editingDeal ? 'Edit Deal' : 'New Deal'}</h2>
            {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Deal Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Enterprise Plan — Acme Corp"
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Value</label>
                  <input
                    type="number"
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder="10000"
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Stage</label>
                  <select
                    value={form.stage}
                    onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Probability (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.probability}
                    onChange={e => setForm(f => ({ ...f, probability: e.target.value }))}
                    placeholder="50"
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Close Date</label>
                  <input
                    type="date"
                    value={form.expectedCloseAt}
                    onChange={e => setForm(f => ({ ...f, expectedCloseAt: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              {companies.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Company</label>
                  <select
                    value={form.companyId}
                    onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">— None —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 gradient-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingDeal ? 'Save Changes' : 'Create Deal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

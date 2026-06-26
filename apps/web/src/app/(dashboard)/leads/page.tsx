'use client';

import { useState, useEffect, useCallback } from 'react';
import { leadApi } from '@/lib/api-client';
import { cn, formatDate } from '@/lib/utils';

interface Lead {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  message?: string;
  status: string;
  source: string;
  score: number;
  createdAt: string;
  qualifiedAt?: string;
  convertedAt?: string;
  assignedTo?: { id: string; user: { name: string; email: string } } | null;
  contact?: { id: string; firstName: string; lastName: string; email: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  NEW: { label: 'New', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
  CONTACTED: { label: 'Contacted', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
  QUALIFIED: { label: 'Qualified', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  UNQUALIFIED: { label: 'Unqualified', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' },
  CONVERTED: { label: 'Converted', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
  LOST: { label: 'Lost', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10' },
};

const SOURCE_CONFIG: Record<string, { label: string; icon: string }> = {
  VIDEO_CALL: { label: 'Video Call', icon: '📹' },
  LIVE_STREAM: { label: 'Live Stream', icon: '📡' },
  AI_CHAT: { label: 'AI Chat', icon: '🤖' },
  SHOPPABLE_VIDEO: { label: 'Shoppable Video', icon: '🛍️' },
  WIDGET: { label: 'Widget', icon: '💬' },
  MANUAL: { label: 'Manual', icon: '✍️' },
  IMPORT: { label: 'Import', icon: '📥' },
};

const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST'];
const SOURCES = ['VIDEO_CALL', 'LIVE_STREAM', 'AI_CHAT', 'SHOPPABLE_VIDEO', 'WIDGET', 'MANUAL', 'IMPORT'];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', message: '', source: 'MANUAL', status: 'NEW', score: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await leadApi.list({
        search: search || undefined,
        status: filterStatus || undefined,
        source: filterSource || undefined,
        page,
        limit: 20,
      });
      setLeads(res?.data ?? []);
      setTotal(res?.total ?? 0);
      setTotalPages(res?.totalPages ?? 1);
    } catch (err) {
      console.error('Failed to fetch leads', err);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterSource, page]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const openCreate = () => {
    setEditingLead(null);
    setForm({ name: '', email: '', phone: '', company: '', message: '', source: 'MANUAL', status: 'NEW', score: '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (l: Lead) => {
    setEditingLead(l);
    setForm({
      name: l.name ?? '',
      email: l.email ?? '',
      phone: l.phone ?? '',
      company: l.company ?? '',
      message: l.message ?? '',
      source: l.source,
      status: l.status,
      score: String(l.score ?? 0),
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        company: form.company || undefined,
        message: form.message || undefined,
        source: form.source,
        status: form.status,
        score: form.score ? parseInt(form.score) : undefined,
      };
      if (editingLead) {
        await leadApi.update(editingLead.id, payload);
      } else {
        await leadApi.create(payload);
      }
      setShowModal(false);
      fetchLeads();
    } catch (err: any) {
      setError(err?.message || 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return;
    try { await leadApi.delete(id); fetchLeads(); } catch (err: any) { alert(err?.message || 'Failed to delete'); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try { await leadApi.update(id, { status }); fetchLeads(); } catch { /* silent */ }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  // Stats summary
  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground mt-1">
            {total > 0 ? `${total} leads — capture, qualify, and convert` : 'Capture, qualify, and convert leads from all channels.'}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2.5 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          Add Lead
        </button>
      </div>

      {/* Status summary pills */}
      {total > 0 && (
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => {
            const cfg = STATUS_CONFIG[s];
            const count = statusCounts[s] ?? 0;
            return (
              <button
                key={s}
                onClick={() => { setFilterStatus(filterStatus === s ? '' : s); setPage(1); }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border',
                  filterStatus === s
                    ? `${cfg.bg} ${cfg.color} border-current`
                    : 'bg-muted/30 text-muted-foreground border-transparent hover:border-border'
                )}
              >
                <span>{cfg.label}</span>
                <span className="font-bold">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by name, email, phone, company..."
            className="flex-1 h-10 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button type="submit" className="px-4 py-2 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all">
            Search
          </button>
          {(search || filterStatus || filterSource) && (
            <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setFilterStatus(''); setFilterSource(''); setPage(1); }} className="px-3 py-2 border border-border text-sm rounded-lg hover:bg-accent transition-colors text-foreground">
              Clear
            </button>
          )}
        </form>
        <select
          value={filterSource}
          onChange={e => { setFilterSource(e.target.value); setPage(1); }}
          className="h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All Sources</option>
          {SOURCES.map(s => <option key={s} value={s}>{SOURCE_CONFIG[s]?.label ?? s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-foreground">No leads yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Leads are captured automatically from video calls, chats, and widgets.</p>
            <button onClick={openCreate} className="px-4 py-2 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all">
              Add Lead Manually
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lead</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map((l) => {
                  const statusCfg = STATUS_CONFIG[l.status] ?? { label: l.status, color: 'text-muted-foreground', bg: 'bg-muted' };
                  const sourceCfg = SOURCE_CONFIG[l.source] ?? { label: l.source, icon: '•' };
                  const displayName = l.name || l.contact ? `${l.contact?.firstName ?? ''} ${l.contact?.lastName ?? ''}`.trim() : 'Unknown';
                  const displayEmail = l.email || l.contact?.email;
                  return (
                    <tr key={l.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-semibold text-foreground">{displayName || '—'}</div>
                          {displayEmail && <div className="text-xs text-muted-foreground">{displayEmail}</div>}
                          {l.phone && <div className="text-xs text-muted-foreground">{l.phone}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{l.company || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{sourceCfg.icon} {sourceCfg.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={l.status}
                          onChange={e => handleStatusChange(l.id, e.target.value)}
                          className={cn(
                            'text-xs font-semibold px-2 py-1 rounded-full border-0 focus:outline-none cursor-pointer',
                            statusCfg.bg, statusCfg.color
                          )}
                          onClick={e => e.stopPropagation()}
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, l.score)}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{l.score}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(l.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(l)} className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" title="Edit">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </button>
                          <button onClick={() => handleDelete(l.id)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Delete">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({total} total)</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-accent transition-colors text-foreground">Previous</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-accent transition-colors text-foreground">Next</button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground">{editingLead ? 'Edit Lead' : 'Add Lead'}</h2>
            {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe"
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Company</label>
                  <input type="text" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Acme Corp"
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@example.com"
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 555 000 0000"
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Source</label>
                  <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                    {SOURCES.map(s => <option key={s} value={s}>{SOURCE_CONFIG[s]?.label ?? s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Score (0–100)</label>
                  <input type="number" min="0" max="100" value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} placeholder="0"
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Message / Notes</label>
                <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Add any notes or message from this lead..." rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 gradient-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50">
                {saving ? 'Saving...' : editingLead ? 'Save Changes' : 'Add Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

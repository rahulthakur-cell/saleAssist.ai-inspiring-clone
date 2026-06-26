'use client';

import { useState, useEffect, useCallback } from 'react';
import { companyApi } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';

interface Company {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  logo?: string;
  createdAt: string;
  _count?: { contacts: number; deals: number };
}

const INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing',
  'Education', 'Real Estate', 'Media', 'Consulting', 'Other',
];

const SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [form, setForm] = useState({ name: '', domain: '', industry: '', size: '', logo: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await companyApi.list({ search, page, limit: 20 });
      setCompanies(res?.data ?? []);
      setTotal(res?.total ?? 0);
      setTotalPages(res?.totalPages ?? 1);
    } catch (err) {
      console.error('Failed to fetch companies', err);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const openCreate = () => {
    setEditingCompany(null);
    setForm({ name: '', domain: '', industry: '', size: '', logo: '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (c: Company) => {
    setEditingCompany(c);
    setForm({ name: c.name, domain: c.domain ?? '', industry: c.industry ?? '', size: c.size ?? '', logo: c.logo ?? '' });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Company name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editingCompany) {
        await companyApi.update(editingCompany.id, form);
      } else {
        await companyApi.create(form);
      }
      setShowModal(false);
      fetchCompanies();
    } catch (err: any) {
      setError(err?.message || 'Failed to save company');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this company? This cannot be undone.')) return;
    try {
      await companyApi.delete(id);
      fetchCompanies();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Companies</h1>
          <p className="text-muted-foreground mt-1">
            {total > 0 ? `${total} companies tracked` : 'Track organizations and their associated contacts and deals.'}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2.5 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          Add Company
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search companies by name, domain, industry..."
          className="flex-1 h-10 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button type="submit" className="px-4 py-2 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all">
          Search
        </button>
        {search && (
          <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="px-4 py-2 border border-border text-sm rounded-lg hover:bg-accent transition-colors text-foreground">
            Clear
          </button>
        )}
      </form>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect width="16" height="20" x="4" y="2" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-foreground">No companies yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Add your first company to start tracking organizations.</p>
            <button onClick={openCreate} className="px-4 py-2 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all">
              Add Company
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Industry</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Size</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contacts</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deals</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Added</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {c.logo ? (
                          <img src={c.logo} alt={c.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-foreground">{c.name}</div>
                          {c.domain && <div className="text-xs text-muted-foreground">{c.domain}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.industry || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.size || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
                        {c._count?.contacts ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                        {c._count?.deals ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-accent transition-colors text-foreground"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-accent transition-colors text-foreground"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground">{editingCompany ? 'Edit Company' : 'Add Company'}</h2>
            {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Company Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Acme Corp"
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Domain</label>
                <input
                  type="text"
                  value={form.domain}
                  onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                  placeholder="acme.com"
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Industry</label>
                  <select
                    value={form.industry}
                    onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Select...</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Size</label>
                  <select
                    value={form.size}
                    onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Select...</option>
                    {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
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
                {saving ? 'Saving...' : editingCompany ? 'Save Changes' : 'Add Company'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

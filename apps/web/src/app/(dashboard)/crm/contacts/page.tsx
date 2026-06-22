'use client';

import { useState, useEffect, useCallback } from 'react';
import { contactApi } from '@/lib/api-client';
import { cn, getInitials, generateAvatarColor } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Plus, Search, X, Phone, Mail, Building2, Tag,
  Trash2, Pencil, User, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';

const SOURCES = ['VIDEO_CALL', 'LIVE_STREAM', 'AI_CHAT', 'SHOPPABLE_VIDEO', 'WIDGET', 'MANUAL'];

interface Contact {
  id: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  source?: string | null;
  tags: string[];
  createdAt: string;
  company?: { id: string; name: string } | null;
}

const sourceLabel: Record<string, string> = {
  VIDEO_CALL: 'Video Call',
  LIVE_STREAM: 'Live Stream',
  AI_CHAT: 'AI Chat',
  SHOPPABLE_VIDEO: 'Shoppable Video',
  WIDGET: 'Widget',
  MANUAL: 'Manual',
  IMPORT: 'Import',
};

const sourceColor: Record<string, string> = {
  VIDEO_CALL: 'bg-violet-500/15 text-violet-400',
  LIVE_STREAM: 'bg-rose-500/15 text-rose-400',
  AI_CHAT: 'bg-blue-500/15 text-blue-400',
  SHOPPABLE_VIDEO: 'bg-amber-500/15 text-amber-400',
  WIDGET: 'bg-emerald-500/15 text-emerald-400',
  MANUAL: 'bg-zinc-500/15 text-zinc-400',
  IMPORT: 'bg-cyan-500/15 text-cyan-400',
};

const emptyForm = () => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  title: '',
  source: '',
  tagsInput: '',
});

export default function ContactsPage() {
  // Data state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Debounced search trigger
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await contactApi.list({
        search: debouncedSearch || undefined,
        source: sourceFilter || undefined,
        page,
        limit: LIMIT,
      });
      setContacts(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sourceFilter, page]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, sourceFilter]);

  function openAdd() {
    setEditContact(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(c: Contact) {
    setEditContact(c);
    setForm({
      firstName: c.firstName,
      lastName: c.lastName || '',
      email: c.email || '',
      phone: c.phone || '',
      title: c.title || '',
      source: c.source || '',
      tagsInput: c.tags.join(', '),
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim()) { toast.error('First name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        title: form.title.trim() || undefined,
        source: form.source || undefined,
        tags: form.tagsInput ? form.tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [],
      };

      if (editContact) {
        await contactApi.update(editContact.id, payload);
        toast.success('Contact updated');
      } else {
        await contactApi.create(payload as any);
        toast.success('Contact created');
      }
      setModalOpen(false);
      fetchContacts();
    } catch (err: any) {
      toast.error(err?.message || (editContact ? 'Failed to update contact' : 'Failed to create contact'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this contact? This action cannot be undone.')) return;
    try {
      setDeletingId(id);
      await contactApi.delete(id);
      toast.success('Contact deleted');
      fetchContacts();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete contact');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {loading ? 'Loading…' : `${total} contact${total !== 1 ? 's' : ''} in your CRM`}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2.5 gradient-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all flex items-center gap-2 shadow-md shadow-violet-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, phone…"
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Sources</option>
          {SOURCES.map(s => <option key={s} value={s}>{sourceLabel[s]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Contact</th>
              <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Company</th>
              <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">Source</th>
              <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Tags</th>
              <th className="text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-violet-500" />
                  <p className="text-sm text-muted-foreground mt-2">Loading contacts…</p>
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <User className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-semibold text-foreground">
                    {debouncedSearch || sourceFilter ? 'No matching contacts' : 'No contacts yet'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {debouncedSearch || sourceFilter ? 'Try adjusting your filters.' : 'Add your first contact to get started.'}
                  </p>
                  {!debouncedSearch && !sourceFilter && (
                    <button
                      onClick={openAdd}
                      className="mt-4 px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-all inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add Contact
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              contacts.map(contact => {
                const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
                return (
                  <tr key={contact.id} className="hover:bg-accent/30 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ring-2 ring-white/10"
                          style={{ backgroundColor: generateAvatarColor(fullName) }}
                        >
                          {getInitials(fullName)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground leading-tight">{fullName}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {contact.email && (
                              <a href={`mailto:${contact.email}`} className="text-xs text-muted-foreground hover:text-violet-400 flex items-center gap-1">
                                <Mail className="w-3 h-3" />{contact.email}
                              </a>
                            )}
                            {contact.phone && (
                              <a href={`tel:${contact.phone}`} className="text-xs text-muted-foreground hover:text-violet-400 flex items-center gap-1">
                                <Phone className="w-3 h-3" />{contact.phone}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {contact.company ? (
                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                          {contact.company.name}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {contact.title && <div className="text-xs text-muted-foreground mt-0.5">{contact.title}</div>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {contact.source ? (
                        <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', sourceColor[contact.source] || 'bg-muted text-muted-foreground')}>
                          {sourceLabel[contact.source] || contact.source}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.length > 0 ? contact.tags.map(tag => (
                          <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-0.5">
                            <Tag className="w-2.5 h-2.5" />{tag}
                          </span>
                        )) : <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(contact)}
                          className="p-1.5 rounded-lg hover:bg-violet-500/10 text-violet-500 transition-all"
                          title="Edit contact"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          disabled={deletingId === contact.id}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-all disabled:opacity-50"
                          title="Delete contact"
                        >
                          {deletingId === contact.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-foreground">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && setModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">
                {editContact ? 'Edit Contact' : 'Add Contact'}
              </h2>
              <button onClick={() => !saving && setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">First Name *</label>
                  <input
                    required
                    type="text"
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    placeholder="John"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Last Name</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    placeholder="Doe"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="john@example.com"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Job Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="VP Sales"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Source</label>
                <select
                  value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-violet-500 transition-colors"
                >
                  <option value="">Select source…</option>
                  {SOURCES.map(s => <option key={s} value={s}>{sourceLabel[s]}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Tags <span className="text-muted-foreground/60 font-normal">(comma separated)</span></label>
                <input
                  type="text"
                  value={form.tagsInput}
                  onChange={e => setForm(f => ({ ...f, tagsInput: e.target.value }))}
                  placeholder="vip, enterprise, hot-lead"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => !saving && setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Saving…' : editContact ? 'Save Changes' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

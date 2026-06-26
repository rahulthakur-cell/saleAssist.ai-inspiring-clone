'use client';

import { useState, useEffect, useCallback } from 'react';
import { teamApi } from '@/lib/api-client';
import { cn, getInitials, generateAvatarColor, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

interface Member {
  id: string;
  userId: string;
  email: string;
  name: string;
  avatar?: string | null;
  role: string;
  customRole?: { id: string; name: string } | null;
  isActive: boolean;
  isAvailable: boolean;
  lastLoginAt?: string | null;
  joinedAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

const ROLES = ['AGENT', 'MANAGER', 'ADMIN', 'VIEWER'];

const roleColors: Record<string, string> = {
  TENANT_OWNER: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  ADMIN: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  MANAGER: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  AGENT: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  VIEWER: 'bg-muted text-muted-foreground',
};

export default function TeamMembersPage() {
  const { user } = useAuthStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'AGENT' });
  const [editRole, setEditRole] = useState('AGENT');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isOwnerOrAdmin = user?.currentTenant?.role === 'TENANT_OWNER' || user?.currentTenant?.role === 'ADMIN';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersData, invitationsData] = await Promise.all([
        teamApi.listMembers(),
        isOwnerOrAdmin ? teamApi.listInvitations?.() : Promise.resolve([]),
      ]);
      setMembers(Array.isArray(membersData) ? membersData : []);
      setInvitations(Array.isArray(invitationsData) ? invitationsData : []);
    } catch (err) {
      console.error('Failed to load team', err);
    } finally {
      setLoading(false);
    }
  }, [isOwnerOrAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleInvite = async () => {
    if (!inviteForm.email.trim()) { setError('Email is required'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await teamApi.invite({ email: inviteForm.email.trim(), role: inviteForm.role });
      setSuccess(`Invitation sent to ${inviteForm.email}`);
      setShowInviteModal(false);
      setInviteForm({ email: '', role: 'AGENT' });
      fetchData();
    } catch (err: any) {
      setError(err?.message || 'Failed to send invitation');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingMember) return;
    setSaving(true); setError('');
    try {
      await teamApi.updateRole(editingMember.id, { role: editRole });
      setShowEditModal(false);
      setEditingMember(null);
      fetchData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (memberId: string, name: string) => {
    if (!confirm(`Remove ${name} from the team?`)) return;
    try {
      await teamApi.removeMember(memberId);
      fetchData();
    } catch (err: any) {
      alert(err?.message || 'Failed to remove member');
    }
  };

  const handleRevokeInvitation = async (id: string, email: string) => {
    if (!confirm(`Revoke invitation for ${email}?`)) return;
    try {
      await teamApi.revokeInvitation?.(id);
      fetchData();
    } catch (err: any) {
      alert(err?.message || 'Failed to revoke invitation');
    }
  };

  const openEdit = (member: Member) => {
    setEditingMember(member);
    setEditRole(member.role);
    setError('');
    setShowEditModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Members</h1>
          <p className="text-muted-foreground mt-1">
            {members.length > 0 ? `${members.length} member${members.length !== 1 ? 's' : ''} in your team` : 'Manage your team, roles, and permissions.'}
          </p>
        </div>
        {isOwnerOrAdmin && (
          <button
            onClick={() => { setShowInviteModal(true); setError(''); setInviteForm({ email: '', role: 'AGENT' }); }}
            className="px-4 py-2.5 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            Invite Member
          </button>
        )}
      </div>

      {/* Success toast */}
      {success && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
          {success}
          <button onClick={() => setSuccess('')} className="ml-auto text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* Members Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {members.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                </div>
                <h3 className="text-base font-semibold text-foreground">No team members yet</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Invite your first team member to get started.</p>
                {isOwnerOrAdmin && (
                  <button onClick={() => setShowInviteModal(true)} className="px-4 py-2 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all">
                    Invite Member
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Member</th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 hidden sm:table-cell">Role</th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 hidden md:table-cell">Status</th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 hidden lg:table-cell">Joined</th>
                    {isOwnerOrAdmin && (
                      <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            {member.avatar ? (
                              <img src={member.avatar} alt={member.name} className="w-9 h-9 rounded-full object-cover" />
                            ) : (
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: generateAvatarColor(member.name) }}
                              >
                                {getInitials(member.name)}
                              </div>
                            )}
                            <div className={cn(
                              'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card',
                              member.isAvailable ? 'bg-emerald-500' : 'bg-muted-foreground/30',
                            )} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                              {member.name}
                              {member.userId === user?.id && (
                                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">(you)</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', roleColors[member.role] || roleColors.VIEWER)}>
                          {member.customRole?.name || member.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={cn('text-xs font-medium', member.isAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                          {member.isAvailable ? '● Available' : '○ Away'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {formatDate(member.joinedAt)}
                      </td>
                      {isOwnerOrAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {member.role !== 'TENANT_OWNER' && (
                              <>
                                <button
                                  onClick={() => openEdit(member)}
                                  className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                                  title="Edit role"
                                >
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                </button>
                                {member.userId !== user?.id && (
                                  <button
                                    onClick={() => handleRemove(member.id, member.name)}
                                    className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                                    title="Remove member"
                                  >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pending Invitations */}
          {isOwnerOrAdmin && invitations.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Pending Invitations</h2>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Email</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 hidden sm:table-cell">Role</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 hidden md:table-cell">Expires</th>
                      <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3.5 h-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                            </div>
                            <span className="text-sm text-foreground">{inv.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', roleColors[inv.role] || roleColors.VIEWER)}>
                            {inv.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                          {formatDate(inv.expiresAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRevokeInvitation(inv.id, inv.email)}
                            className="text-xs text-destructive hover:text-destructive/80 font-medium"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowInviteModal(false)}>
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-bold text-foreground">Invite Team Member</h2>
              <p className="text-sm text-muted-foreground mt-1">Send an invitation link to a new team member.</p>
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email Address *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="colleague@company.com"
                  autoFocus
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowInviteModal(false)} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors">Cancel</button>
              <button onClick={handleInvite} disabled={saving} className="flex-1 py-2 gradient-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50">
                {saving ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditModal && editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowEditModal(false)}>
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-bold text-foreground">Change Role</h2>
              <p className="text-sm text-muted-foreground mt-1">Update role for <strong>{editingMember.name}</strong></p>
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">New Role</label>
              <select
                value={editRole}
                onChange={e => setEditRole(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowEditModal(false)} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors">Cancel</button>
              <button onClick={handleEditSave} disabled={saving} className="flex-1 py-2 gradient-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { cn, getInitials, generateAvatarColor } from '@/lib/utils';

const mockMembers = [
  { id: '1', name: 'Super Admin', email: 'admin@saleassist.local', role: 'TENANT_OWNER', isActive: true, isAvailable: true },
  { id: '2', name: 'Demo Agent', email: 'agent@saleassist.local', role: 'AGENT', isActive: true, isAvailable: true },
  { id: '3', name: 'Sarah Kim', email: 'sarah@saleassist.local', role: 'MANAGER', isActive: true, isAvailable: false },
  { id: '4', name: 'Mike Roberts', email: 'mike@saleassist.local', role: 'AGENT', isActive: true, isAvailable: true },
];

const roleColors: Record<string, string> = {
  TENANT_OWNER: 'bg-violet-500/10 text-violet-600',
  ADMIN: 'bg-red-500/10 text-red-600',
  MANAGER: 'bg-amber-500/10 text-amber-600',
  AGENT: 'bg-indigo-500/10 text-indigo-600',
  VIEWER: 'bg-muted text-muted-foreground',
};

export default function TeamMembersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Members</h1>
          <p className="text-muted-foreground mt-1">Manage your team, roles, and permissions.</p>
        </div>
        <button className="px-4 py-2.5 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          Invite Member
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Member</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Role</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">Status</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mockMembers.map((member) => (
              <tr key={member.id} className="hover:bg-accent/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: generateAvatarColor(member.name) }}
                      >
                        {getInitials(member.name)}
                      </div>
                      <div className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card',
                        member.isAvailable ? 'bg-emerald-500' : 'bg-muted-foreground/30',
                      )} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{member.name}</div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', roleColors[member.role] || roleColors.VIEWER)}>
                    {member.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={cn('text-xs', member.isAvailable ? 'text-emerald-600' : 'text-muted-foreground')}>
                    {member.isAvailable ? 'Available' : 'Away'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-xs text-primary hover:text-primary/80 font-medium">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import { cn, getInitials, generateAvatarColor } from '@/lib/utils';

const mockContacts = [
  { id: '1', firstName: 'Sarah', lastName: 'Chen', email: 'sarah@example.com', company: 'TechCorp', title: 'VP Sales', source: 'VIDEO_CALL', tags: ['vip', 'enterprise'] },
  { id: '2', firstName: 'James', lastName: 'Wilson', email: 'james@startup.io', company: 'StartupIO', title: 'Founder', source: 'WIDGET', tags: ['hot-lead'] },
  { id: '3', firstName: 'Priya', lastName: 'Sharma', email: 'priya@retail.com', company: 'RetailMax', title: 'Head of E-comm', source: 'LIVE_STREAM', tags: ['retail'] },
  { id: '4', firstName: 'Mike', lastName: 'Roberts', email: 'mike@agency.co', company: 'Digital Agency', title: 'Director', source: 'AI_CHAT', tags: [] },
  { id: '5', firstName: 'Emily', lastName: 'Tang', email: 'emily@fashion.com', company: 'FashionHub', title: 'CMO', source: 'SHOPPABLE_VIDEO', tags: ['fashion', 'vip'] },
];

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
          <p className="text-muted-foreground mt-1">Manage your customer contacts and relationships.</p>
        </div>
        <button className="px-4 py-2.5 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          Add Contact
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input type="text" placeholder="Search contacts..." className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all" />
        </div>
        <select className="h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">All Sources</option>
          <option value="VIDEO_CALL">Video Call</option>
          <option value="LIVE_STREAM">Live Stream</option>
          <option value="AI_CHAT">AI Chat</option>
          <option value="WIDGET">Widget</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Contact</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Company</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">Source</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Tags</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mockContacts.map((contact) => (
              <tr key={contact.id} className="hover:bg-accent/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: generateAvatarColor(`${contact.firstName} ${contact.lastName}`) }}
                    >
                      {getInitials(`${contact.firstName} ${contact.lastName}`)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{contact.firstName} {contact.lastName}</div>
                      <div className="text-xs text-muted-foreground">{contact.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <div className="text-sm text-foreground">{contact.company}</div>
                  <div className="text-xs text-muted-foreground">{contact.title}</div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {contact.source.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex gap-1">
                    {contact.tags.map((tag) => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-xs text-primary hover:text-primary/80 font-medium">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { cn, getInitials, generateAvatarColor } from '@/lib/utils';
import { searchApi } from '@/lib/api-client';

// ─── Navigation Items ─────────────────────────────────

const navItems = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboardIcon },
    ],
  },
  {
    title: 'Engage',
    items: [
      { name: 'Video Calls', href: '/video-calls', icon: VideoIcon },
      { name: 'Assets', href: '/assets', icon: FolderOpenIcon },
      { name: 'Live Streams', href: '/live-streams', icon: RadioIcon },
      { name: 'Shoppable Videos', href: '/shoppable-videos', icon: ShoppingBagIcon },
      { name: 'Video FAQ', href: '/video-faq', icon: HelpCircleIcon },
      { name: 'AI Chat', href: '/ai-chat', icon: BotIcon },
    ],
  },
  {
    title: 'Manage',
    items: [
      { name: 'Contacts', href: '/crm/contacts', icon: UsersIcon },
      { name: 'Companies', href: '/crm/companies', icon: BuildingIcon },
      { name: 'Deals', href: '/crm/deals', icon: HandshakeIcon },
      { name: 'Leads', href: '/leads', icon: TargetIcon },
    ],
  },
  {
    title: 'Analyze',
    items: [
      { name: 'Analytics', href: '/analytics', icon: BarChartIcon },
      { name: 'Visitors', href: '/analytics/visitors', icon: EyeIcon },
    ],
  },
  {
    title: 'Configure',
    items: [
      { name: 'Team', href: '/team/members', icon: UserGroupIcon },
      { name: 'Widget', href: '/widget', icon: CodeIcon },
      { name: 'Billing', href: '/billing', icon: CreditCardIcon },
      { name: 'Settings', href: '/settings/general', icon: SettingsIcon },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, loadUser, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Search Modal states
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal(true);
      }
      if (e.key === 'Escape') {
        setShowSearchModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const hits = await searchApi.query(searchQuery);
        setSearchResults(hits || []);
      } catch (err) {
        console.error('Search query failed', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-white animate-pulse">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 lg:relative',
          sidebarCollapsed ? 'w-[68px]' : 'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center h-16 px-4 border-b border-sidebar-border', sidebarCollapsed && 'justify-center')}>
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center text-white flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            {!sidebarCollapsed && (
              <span className="text-lg font-bold text-sidebar-foreground">SaleAssist</span>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-3">
          {navItems.map((section) => (
            <div key={section.title} className="mb-6">
              {!sidebarCollapsed && (
                <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section.title}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                          : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/10',
                        sidebarCollapsed && 'justify-center px-2',
                      )}
                      title={sidebarCollapsed ? item.name : undefined}
                    >
                      <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                      {!sidebarCollapsed && item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User section */}
        <div className={cn('p-3 border-t border-sidebar-border', sidebarCollapsed && 'flex justify-center')}>
          {sidebarCollapsed ? (
            <button
              onClick={handleLogout}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-sidebar-accent/10 transition-colors"
              title="Logout"
            >
              <LogOutIcon className="w-4 h-4 text-sidebar-foreground/70" />
            </button>
          ) : (
            <div className="flex items-center gap-3 px-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: generateAvatarColor(user.name) }}
              >
                {getInitials(user.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</div>
                <div className="text-xs text-muted-foreground truncate">{user.currentTenant?.name}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md hover:bg-sidebar-accent/10 transition-colors"
                title="Logout"
              >
                <LogOutIcon className="w-4 h-4 text-sidebar-foreground/60" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex items-center h-16 px-4 sm:px-6 border-b border-border bg-background/95 backdrop-blur-sm">
          {/* Mobile menu */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden mr-4 p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <MenuIcon className="w-5 h-5" />
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-2 rounded-lg hover:bg-accent transition-colors mr-4"
          >
            <PanelLeftIcon className={cn('w-5 h-5 transition-transform', sidebarCollapsed && 'rotate-180')} />
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md cursor-pointer" onClick={() => setShowSearchModal(true)}>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                readOnly
                placeholder="Search contacts, videos, leads..."
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none cursor-pointer transition-all"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground font-mono">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 ml-4">
            <button className="relative p-2 rounded-lg hover:bg-accent transition-colors">
              <BellIcon className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>

      {/* Meilisearch Overlay Modal */}
      {showSearchModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-20"
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl p-5 flex flex-col max-h-[500px] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="relative shrink-0">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search videos, FAQs, contacts, leads..."
                className="w-full h-12 pl-11 pr-12 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-indigo-500"
                autoFocus
              />
              <button
                onClick={() => setShowSearchModal(false)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs bg-muted px-2.5 py-1 rounded text-muted-foreground hover:text-foreground font-semibold"
              >
                ESC
              </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              {searchLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                </div>
              ) : searchQuery.trim() && searchResults.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-500">
                  No matches found for "{searchQuery}". Try another keyword.
                </div>
              ) : !searchQuery.trim() ? (
                <div className="text-center py-8 text-xs text-zinc-500">
                  Type keywords to search across shoppable videos, FAQs, contacts, and leads.
                </div>
              ) : (
                <div className="space-y-4">
                  {['video', 'faq', 'contact', 'lead'].map((type) => {
                    const items = searchResults.filter((h) => h.type === type);
                    if (items.length === 0) return null;
                    return (
                      <div key={type} className="space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block px-1">
                          {type}s
                        </span>
                        <div className="space-y-1">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => {
                                setShowSearchModal(false);
                                setSearchQuery('');
                                router.push(item.url);
                              }}
                              className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/10 hover:bg-indigo-500/5 hover:border-indigo-500/30 cursor-pointer transition-all"
                            >
                              <div>
                                <h6 className="text-xs font-bold text-foreground">{item.title}</h6>
                                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                                  {item.description}
                                </p>
                              </div>
                              <span className="text-[10px] font-semibold text-indigo-400">
                                View details →
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Icon Components (inline SVG for zero-dep) ────────

function LayoutDashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}
function VideoIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect width="15" height="14" x="1" y="5" rx="2" ry="2" /></svg>;
}
function FolderOpenIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5L20.8 18H5.2a2 2 0 0 1-1.94-1.5L2 11h4Z" /><path d="M22 10H10.8a2 2 0 0 0-1.8 1.1L8 13H4a2 2 0 0 1-1.94-1.5L1 6.5A2.5 2.5 0 0 1 3.5 4h4a2.5 2.5 0 0 1 2.32 1.57L10.5 7H18a2 2 0 0 1 2 2Z" /></svg>;
}
function RadioIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" /><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4" /><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4" /><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" /><circle cx="12" cy="12" r="2" /></svg>;
}
function ShoppingBagIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>;
}
function HelpCircleIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>;
}
function BotIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>;
}
function UsersIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}
function BuildingIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" /></svg>;
}
function HandshakeIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m11 17 2 2a1 1 0 1 0 3-3" /><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" /><path d="m21 3 1 11h-2" /><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" /><path d="M3 4h8" /></svg>;
}
function TargetIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
}
function BarChartIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" /></svg>;
}
function EyeIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function UserGroupIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 21a8 8 0 0 0-16 0" /><circle cx="10" cy="8" r="5" /><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" /></svg>;
}
function CodeIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>;
}
function CreditCardIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>;
}
function SettingsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function LogOutIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>;
}
function MenuIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>;
}
function PanelLeftIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /></svg>;
}
function SearchIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>;
}
function BellIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
}

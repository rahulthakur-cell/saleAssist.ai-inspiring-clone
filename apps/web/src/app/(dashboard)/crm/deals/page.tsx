'use client';

import { cn, formatCurrency } from '@/lib/utils';

const stages = [
  { name: 'Prospecting', color: 'bg-blue-500', deals: [
    { id: '1', title: 'Enterprise Plan — TechCorp', value: 15000, owner: 'Sarah K.' },
    { id: '2', title: 'Starter — StartupIO', value: 2400, owner: 'Mike R.' },
  ]},
  { name: 'Qualification', color: 'bg-indigo-500', deals: [
    { id: '3', title: 'Professional — RetailMax', value: 8500, owner: 'Emily T.' },
  ]},
  { name: 'Proposal', color: 'bg-violet-500', deals: [
    { id: '4', title: 'Enterprise — FashionHub', value: 24000, owner: 'Sarah K.' },
    { id: '5', title: 'Professional — MediaCo', value: 6000, owner: 'James L.' },
  ]},
  { name: 'Negotiation', color: 'bg-amber-500', deals: [
    { id: '6', title: 'Enterprise — BigRetail', value: 36000, owner: 'Sarah K.' },
  ]},
  { name: 'Closed Won', color: 'bg-emerald-500', deals: [] },
];

export default function DealsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deals Pipeline</h1>
          <p className="text-muted-foreground mt-1">Track deals across your sales pipeline stages.</p>
        </div>
        <button className="px-4 py-2.5 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          New Deal
        </button>
      </div>

      {/* Pipeline Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {stages.map((stage) => (
          <div key={stage.name} className="flex-shrink-0 w-72">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn('w-2.5 h-2.5 rounded-full', stage.color)} />
              <h3 className="text-sm font-semibold text-foreground">{stage.name}</h3>
              <span className="text-xs text-muted-foreground ml-auto">{stage.deals.length}</span>
            </div>
            <div className="space-y-2">
              {stage.deals.map((deal) => (
                <div key={deal.id} className="rounded-lg border border-border bg-card p-3 hover:shadow-md transition-all cursor-pointer">
                  <div className="text-sm font-medium text-foreground">{deal.title}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-semibold text-primary">{formatCurrency(deal.value)}</span>
                    <span className="text-xs text-muted-foreground">{deal.owner}</span>
                  </div>
                </div>
              ))}
              {stage.deals.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <p className="text-xs text-muted-foreground">No deals</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

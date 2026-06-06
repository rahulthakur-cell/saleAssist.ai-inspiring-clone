export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground mt-1">Capture, qualify, and convert leads from all channels.</p>
        </div>
        <button className="px-4 py-2.5 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          Add Lead
        </button>
      </div>
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <h3 className="text-lg font-semibold text-foreground">Lead Management</h3>
        <p className="text-sm text-muted-foreground mt-2">Automated lead capture, scoring, assignment, and conversion. Coming in Phase 4.</p>
      </div>
    </div>
  );
}

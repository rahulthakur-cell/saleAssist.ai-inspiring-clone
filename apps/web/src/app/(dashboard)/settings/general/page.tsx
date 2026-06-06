export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your organization and application preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Nav */}
        <div className="rounded-xl border border-border bg-card p-2">
          {[
            { name: 'General', href: '/settings/general', active: true },
            { name: 'Branding', href: '/settings/branding', active: false },
            { name: 'Notifications', href: '/settings/notifications', active: false },
            { name: 'API Keys', href: '/settings/api-keys', active: false },
            { name: 'Integrations', href: '/settings/integrations', active: false },
            { name: 'Danger Zone', href: '/settings/danger', active: false },
          ].map((item) => (
            <button
              key={item.name}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                item.active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>

        {/* Settings Form */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6 space-y-6">
          <h3 className="text-lg font-semibold text-foreground">General Settings</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Organization Name</label>
              <input type="text" defaultValue="Demo Store" className="w-full h-10 px-4 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Organization Slug</label>
              <div className="flex items-center">
                <span className="h-10 px-3 flex items-center rounded-l-lg border border-r-0 border-input bg-muted text-sm text-muted-foreground">saleassist.ai/</span>
                <input type="text" defaultValue="demo" className="w-full h-10 px-4 rounded-r-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Timezone</label>
                <select className="w-full h-10 px-4 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  <option>Asia/Kolkata (IST)</option>
                  <option>America/New_York (EST)</option>
                  <option>Europe/London (GMT)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Currency</label>
                <select className="w-full h-10 px-4 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  <option>INR (₹)</option>
                  <option>USD ($)</option>
                  <option>EUR (€)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <button className="px-6 py-2.5 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

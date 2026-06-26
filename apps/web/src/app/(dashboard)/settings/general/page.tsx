'use client';

import { useState, useEffect, useCallback } from 'react';
import { tenantApi, userApi, apiKeyApi, storageApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

type SettingsTab = 'general' | 'profile' | 'usage' | 'branding' | 'integrations' | 'notifications' | 'apikeys' | 'danger';

const TIMEZONES = [
  'Asia/Kolkata', 'America/New_York', 'America/Los_Angeles', 'America/Chicago',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore',
  'Australia/Sydney', 'UTC',
];
const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'JPY'];

export default function SettingsPage() {
  const { user, loadUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // Organization settings
  const [tenant, setTenant] = useState<any>(null);
  const [orgForm, setOrgForm] = useState({ name: '', slug: '', timezone: 'Asia/Kolkata', currency: 'USD' });
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgSuccess, setOrgSuccess] = useState('');
  const [orgError, setOrgError] = useState('');

  // Profile settings
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Usage stats
  const [usage, setUsage] = useState<any>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // Branding settings
  const [brandForm, setBrandForm] = useState({ logo: '', brandColor: '#6366f1', website: '', supportEmail: '' });
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingSuccess, setBrandingSuccess] = useState('');
  const [brandingError, setBrandingError] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  // Integrations settings
  const [integrationsForm, setIntegrationsForm] = useState({
    slack: '',
    zapier: '',
    hubspot: '',
    salesforce: '',
    googleAnalytics: '',
  });
  const [editingIntegration, setEditingIntegration] = useState<string | null>(null);
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [integrationSuccess, setIntegrationSuccess] = useState('');
  const [integrationError, setIntegrationError] = useState('');

  // Notifications settings
  const [notificationsForm, setNotificationsForm] = useState({
    newCall: true,
    newLead: true,
    weeklyReport: false,
    billingAlerts: true,
  });
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [notificationsSuccess, setNotificationsSuccess] = useState('');
  const [notificationsError, setNotificationsError] = useState('');

  // API Keys settings
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['*']);
  const [isCreateKeyModalOpen, setIsCreateKeyModalOpen] = useState(false);
  const [createdKeyRaw, setCreatedKeyRaw] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState('');
  const [apiKeySuccess, setApiKeySuccess] = useState('');

  // Danger Zone settings
  const [confirmOrgName, setConfirmOrgName] = useState('');
  const [dangerError, setDangerError] = useState('');
  const [dangerSuccess, setDangerSuccess] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Load org settings
  const fetchOrg = useCallback(async () => {
    setOrgLoading(true);
    try {
      const data: any = await tenantApi.getCurrent();
      setTenant(data);
      setOrgForm({
        name: data?.name || '',
        slug: data?.slug || '',
        timezone: data?.settings?.timezone || 'Asia/Kolkata',
        currency: data?.settings?.currency || 'USD',
      });
      setBrandForm({
        logo: data?.logo || '',
        brandColor: data?.settings?.brandColor || '#6366f1',
        website: data?.settings?.website || '',
        supportEmail: data?.settings?.supportEmail || '',
      });
      setIntegrationsForm({
        slack: data?.settings?.integrations?.slack?.webhookUrl || '',
        zapier: data?.settings?.integrations?.zapier?.apiKey || '',
        hubspot: data?.settings?.integrations?.hubspot?.apiKey || '',
        salesforce: data?.settings?.integrations?.salesforce?.token || '',
        googleAnalytics: data?.settings?.integrations?.googleAnalytics?.measurementId || '',
      });
      setNotificationsForm({
        newCall: data?.settings?.notifications?.newCall !== false,
        newLead: data?.settings?.notifications?.newLead !== false,
        weeklyReport: data?.settings?.notifications?.weeklyReport === true,
        billingAlerts: data?.settings?.notifications?.billingAlerts !== false,
      });
    } catch (err) {
      console.error('Failed to load org', err);
    } finally {
      setOrgLoading(false);
    }
  }, []);

  // Load API keys
  const fetchApiKeys = useCallback(async () => {
    setApiKeysLoading(true);
    setApiKeyError('');
    try {
      const keys = await apiKeyApi.list();
      setApiKeys(keys);
    } catch (err: any) {
      setApiKeyError(err?.message || 'Failed to load API keys');
    } finally {
      setApiKeysLoading(false);
    }
  }, []);

  // Load usage
  const fetchUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      const data = await tenantApi.getUsage();
      setUsage(data);
    } catch (err) {
      console.error('Failed to load usage', err);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrg();
    if (user) {
      setProfileForm({ name: user.name || '', phone: '' });
    }
  }, [fetchOrg, user]);

  useEffect(() => {
    if (activeTab === 'usage') fetchUsage();
    if (activeTab === 'apikeys') fetchApiKeys();
  }, [activeTab, fetchUsage, fetchApiKeys]);

  const handleOrgSave = async () => {
    if (!orgForm.name.trim()) { setOrgError('Organization name is required'); return; }
    setOrgSaving(true); setOrgError(''); setOrgSuccess('');
    try {
      const updated = await tenantApi.update({
        name: orgForm.name,
        settings: { ...tenant?.settings, timezone: orgForm.timezone, currency: orgForm.currency },
      });
      setTenant(updated);
      setOrgSuccess('Organization settings saved successfully.');
      setTimeout(() => setOrgSuccess(''), 4000);
    } catch (err: any) {
      setOrgError(err?.message || 'Failed to save settings');
    } finally {
      setOrgSaving(false);
    }
  };

  const handleProfileSave = async () => {
    if (!profileForm.name.trim()) { setProfileError('Name is required'); return; }
    setProfileSaving(true); setProfileError(''); setProfileSuccess('');
    try {
      await userApi.updateProfile({ name: profileForm.name, phone: profileForm.phone || undefined });
      await loadUser(); // Refresh auth store with new name
      setProfileSuccess('Profile updated successfully.');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    setBrandingError('');
    setBrandingSuccess('');

    try {
      const { uploadUrl, publicUrl } = await storageApi.getPresignedUrl(file.name, file.type);

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!response.ok) {
        throw new Error('Failed to upload logo file');
      }

      setBrandForm(f => ({ ...f, logo: publicUrl }));
      setBrandingSuccess('Logo uploaded successfully. Click Save Changes to apply.');
    } catch (err: any) {
      setBrandingError(err?.message || 'Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleBrandingSave = async () => {
    setBrandingSaving(true);
    setBrandingError('');
    setBrandingSuccess('');
    try {
      const updated = await tenantApi.update({
        logo: brandForm.logo,
        settings: {
          ...tenant?.settings,
          brandColor: brandForm.brandColor,
          website: brandForm.website,
          supportEmail: brandForm.supportEmail,
        },
      });
      setTenant(updated);
      setBrandingSuccess('Branding settings updated successfully.');
      setTimeout(() => setBrandingSuccess(''), 4000);
    } catch (err: any) {
      setBrandingError(err?.message || 'Failed to save branding settings');
    } finally {
      setBrandingSaving(false);
    }
  };

  const handleIntegrationSave = async (name: string) => {
    setIntegrationSaving(true);
    setIntegrationError('');
    setIntegrationSuccess('');
    try {
      const credential = (integrationsForm as any)[name];
      if (!credential?.trim()) {
        throw new Error('Credential field is required.');
      }

      const integrations = {
        ...tenant?.settings?.integrations,
        [name]: {
          connected: true,
          connectedAt: new Date().toISOString(),
          ...(name === 'slack' && { webhookUrl: credential }),
          ...(name === 'zapier' && { apiKey: credential }),
          ...(name === 'hubspot' && { apiKey: credential }),
          ...(name === 'salesforce' && { token: credential }),
          ...(name === 'googleAnalytics' && { measurementId: credential }),
        },
      };

      const updated = await tenantApi.update({
        settings: {
          ...tenant?.settings,
          integrations,
        },
      });

      setTenant(updated);
      setEditingIntegration(null);
      setIntegrationSuccess(`${name.toUpperCase()} integrated successfully.`);
      setTimeout(() => setIntegrationSuccess(''), 4000);
    } catch (err: any) {
      setIntegrationError(err?.message || 'Failed to save integration');
    } finally {
      setIntegrationSaving(false);
    }
  };

  const handleIntegrationDisconnect = async (name: string) => {
    setIntegrationSaving(true);
    setIntegrationError('');
    setIntegrationSuccess('');
    try {
      const integrations = {
        ...tenant?.settings?.integrations,
        [name]: null,
      };

      const updated = await tenantApi.update({
        settings: {
          ...tenant?.settings,
          integrations,
        },
      });

      setTenant(updated);
      setIntegrationsForm(f => ({ ...f, [name]: '' }));
      setIntegrationSuccess(`${name.toUpperCase()} integration removed.`);
      setTimeout(() => setIntegrationSuccess(''), 4000);
    } catch (err: any) {
      setIntegrationError(err?.message || 'Failed to disconnect integration');
    } finally {
      setIntegrationSaving(false);
    }
  };

  const handleNotificationsSave = async () => {
    setNotificationsSaving(true);
    setNotificationsError('');
    setNotificationsSuccess('');
    try {
      const updated = await tenantApi.update({
        settings: {
          ...tenant?.settings,
          notifications: notificationsForm,
        },
      });
      setTenant(updated);
      setNotificationsSuccess('Notification settings updated successfully.');
      setTimeout(() => setNotificationsSuccess(''), 4000);
    } catch (err: any) {
      setNotificationsError(err?.message || 'Failed to save notifications');
    } finally {
      setNotificationsSaving(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) {
      setApiKeyError('API Key name is required');
      return;
    }
    setApiKeysLoading(true);
    setApiKeyError('');
    setApiKeySuccess('');
    try {
      const res = await apiKeyApi.create({
        name: newKeyName,
        permissions: newKeyPermissions,
      });
      setCreatedKeyRaw(res.rawKey);
      setNewKeyName('');
      setNewKeyPermissions(['*']);
      setApiKeySuccess('API Key generated successfully.');
      fetchApiKeys();
    } catch (err: any) {
      setApiKeyError(err?.message || 'Failed to generate API Key');
    } finally {
      setApiKeysLoading(false);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API Key? Any integrations using it will fail immediately.')) return;
    setApiKeysLoading(true);
    setApiKeyError('');
    setApiKeySuccess('');
    try {
      await apiKeyApi.revoke(id);
      setApiKeySuccess('API Key revoked.');
      fetchApiKeys();
    } catch (err: any) {
      setApiKeyError(err?.message || 'Failed to revoke API key');
      setApiKeysLoading(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (confirmOrgName !== tenant?.name) {
      setDangerError('Please enter the exact organization name to confirm.');
      return;
    }
    setIsDeleting(true);
    setDangerError('');
    setDangerSuccess('');
    try {
      await tenantApi.delete();
      setDangerSuccess('Organization deleted successfully. Logging out...');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (err: any) {
      setDangerError(err?.message || 'Failed to delete organization');
      setIsDeleting(false);
    }
  };

  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'general',
      label: 'General',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /></svg>,
    },
    {
      key: 'profile',
      label: 'My Profile',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    },
    {
      key: 'usage',
      label: 'Usage & Limits',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" /></svg>,
    },
    {
      key: 'branding',
      label: 'Branding',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><circle cx="12" cy="11" r="3" /></svg>,
    },
    {
      key: 'integrations',
      label: 'Integrations',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
    },
    {
      key: 'notifications',
      label: 'Notifications',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
    },
    {
      key: 'apikeys',
      label: 'API Keys',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>,
    },
    {
      key: 'danger',
      label: 'Danger Zone',
      icon: <svg className="w-4 h-4 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
    },
  ];

  const isOwner = user?.currentTenant?.role === 'TENANT_OWNER';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your organization preferences, keys, notifications, and branding.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Nav */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-2 space-y-0.5 shadow-sm">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'gradient-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">

          {/* ── General Settings ── */}
          {activeTab === 'general' && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">Organization Settings</h2>

              {orgLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : (
                <>
                  {orgSuccess && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      {orgSuccess}
                    </div>
                  )}
                  {orgError && (
                    <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{orgError}</div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Organization Name *</label>
                      <input
                        type="text"
                        value={orgForm.name}
                        onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Acme Corp"
                        className="w-full h-10 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Organization Slug</label>
                      <div className="flex items-center">
                        <span className="h-10 px-3 flex items-center rounded-l-lg border border-r-0 border-input bg-muted text-sm text-muted-foreground">
                          saleassist.ai/
                        </span>
                        <input
                          type="text"
                          value={orgForm.slug}
                          readOnly
                          className="flex-1 h-10 px-4 rounded-r-lg border border-input bg-muted/30 text-sm text-muted-foreground cursor-not-allowed focus:outline-none"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Slug cannot be changed after creation.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Timezone</label>
                        <select
                          value={orgForm.timezone}
                          onChange={e => setOrgForm(f => ({ ...f, timezone: e.target.value }))}
                          className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          {TIMEZONES.map(tz => (
                            <option key={tz} value={tz}>{tz}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Default Currency</label>
                        <select
                          value={orgForm.currency}
                          onChange={e => setOrgForm(f => ({ ...f, currency: e.target.value }))}
                          className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          {CURRENCIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-4 border-t border-border">
                    <button
                      onClick={handleOrgSave}
                      disabled={orgSaving}
                      className="px-6 py-2.5 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {orgSaving && <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                      {orgSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── My Profile ── */}
          {activeTab === 'profile' && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">My Profile</h2>

              {user && (
                <div className="flex items-center gap-4 pb-4 border-b border-border">
                  <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-base">{user.name}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {user.currentTenant?.role?.replace(/_/g, ' ')} at {user.currentTenant?.name}
                    </div>
                  </div>
                </div>
              )}

              {profileSuccess && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  {profileSuccess}
                </div>
              )}
              {profileError && (
                <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{profileError}</div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Full Name *</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="John Doe"
                    className="w-full h-10 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    className="w-full h-10 px-4 rounded-lg border border-input bg-muted/30 text-sm text-muted-foreground cursor-not-allowed focus:outline-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Email cannot be changed here.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+1 555 000 0000"
                    className="w-full h-10 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border">
                <button
                  onClick={handleProfileSave}
                  disabled={profileSaving}
                  className="px-6 py-2.5 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {profileSaving && <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                  {profileSaving ? 'Saving...' : 'Update Profile'}
                </button>
              </div>
            </div>
          )}

          {/* ── Usage & Limits ── */}
          {activeTab === 'usage' && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">Usage & Limits</h2>

              {usageLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : usage ? (
                <div className="space-y-5">
                  {[
                    {
                      label: 'Team Members',
                      used: usage.agentsUsed,
                      limit: usage.agentsLimit,
                      unit: 'members',
                      color: 'from-indigo-500 to-violet-500',
                    },
                    {
                      label: 'Video Minutes (This Month)',
                      used: usage.videoMinutesUsed,
                      limit: usage.videoMinutesLimit,
                      unit: 'min',
                      color: 'from-blue-500 to-cyan-500',
                    },
                    {
                      label: 'Storage Used',
                      used: parseFloat((usage.storageUsedGb || 0).toFixed(2)),
                      limit: usage.storageLimitGb,
                      unit: 'GB',
                      color: 'from-emerald-500 to-teal-500',
                    },
                  ].map(stat => {
                    const pct = Math.min(100, stat.limit > 0 ? (stat.used / stat.limit) * 100 : 0);
                    const isWarning = pct >= 80;
                    const isDanger = pct >= 95;
                    return (
                      <div key={stat.label}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground">{stat.label}</span>
                          <span className={`text-sm font-semibold ${isDanger ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-muted-foreground'}`}>
                            {stat.used} / {stat.limit} {stat.unit}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r transition-all ${isDanger ? 'from-rose-500 to-rose-600' : isWarning ? 'from-amber-500 to-orange-500' : stat.color}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {isDanger && (
                          <p className="text-xs text-rose-500 mt-1">⚠ Approaching limit — consider upgrading your plan.</p>
                        )}
                      </div>
                    );
                  })}

                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Current Plan</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {user?.currentTenant?.plan || 'FREE'} plan
                        </div>
                      </div>
                      <a href="/billing" className="px-4 py-2 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all">
                        Upgrade Plan
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Failed to load usage data. Please try again.</p>
              )}
            </div>
          )}

          {/* ── Branding Settings ── */}
          {activeTab === 'branding' && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">Organization Branding</h2>

              {brandingSuccess && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  {brandingSuccess}
                </div>
              )}
              {brandingError && (
                <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{brandingError}</div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">Organization Logo</label>
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-xl border border-border bg-muted/40 flex items-center justify-center overflow-hidden flex-shrink-0 relative group">
                      {brandForm.logo ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={brandForm.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                      ) : (
                        <span className="text-muted-foreground text-xs font-semibold">No Logo</span>
                      )}
                      {logoUploading && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-all cursor-pointer">
                        <span>Upload Logo File</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
                      </label>
                      <p className="text-xs text-muted-foreground">Supported formats: PNG, JPG, SVG. Max size: 2MB.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Primary Brand Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={brandForm.brandColor}
                        onChange={e => setBrandForm(f => ({ ...f, brandColor: e.target.value }))}
                        className="w-10 h-10 rounded-lg border border-input bg-transparent cursor-pointer p-0.5 overflow-hidden"
                      />
                      <input
                        type="text"
                        value={brandForm.brandColor}
                        onChange={e => setBrandForm(f => ({ ...f, brandColor: e.target.value }))}
                        placeholder="#6366f1"
                        maxLength={7}
                        className="flex-1 h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Used for matching player widgets and chat links.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Support Email Address</label>
                    <input
                      type="email"
                      value={brandForm.supportEmail}
                      onChange={e => setBrandForm(f => ({ ...f, supportEmail: e.target.value }))}
                      placeholder="support@acme.com"
                      className="w-full h-10 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Company Website URL</label>
                  <input
                    type="url"
                    value={brandForm.website}
                    onChange={e => setBrandForm(f => ({ ...f, website: e.target.value }))}
                    placeholder="https://acme.com"
                    className="w-full h-10 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border">
                <button
                  onClick={handleBrandingSave}
                  disabled={brandingSaving || logoUploading}
                  className="px-6 py-2.5 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {brandingSaving && <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                  {brandingSaving ? 'Saving...' : 'Save Branding'}
                </button>
              </div>
            </div>
          )}

          {/* ── Integrations Settings ── */}
          {activeTab === 'integrations' && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-6 shadow-sm">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-foreground">Integrations</h2>
                <span className="px-2 py-1 bg-accent rounded text-xs text-muted-foreground font-medium">Real-time sync</span>
              </div>

              {integrationSuccess && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  {integrationSuccess}
                </div>
              )}
              {integrationError && (
                <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{integrationError}</div>
              )}

              <div className="space-y-4">
                {[
                  {
                    name: 'slack',
                    label: 'Slack Webhook',
                    desc: 'Post alert notifications about incoming calls and new leads directly inside channels.',
                    placeholder: 'https://hooks.slack.com/services/...',
                    iconBg: 'bg-emerald-500/10 text-emerald-600',
                    icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>,
                  },
                  {
                    name: 'googleAnalytics',
                    label: 'Google Analytics 4',
                    desc: 'Track stream interactions, viewer counts, and video call metrics directly in GA4 dashboard.',
                    placeholder: 'G-XXXXXXXXXX',
                    iconBg: 'bg-amber-500/10 text-amber-600',
                    icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>,
                  },
                  {
                    name: 'zapier',
                    label: 'Zapier Key',
                    desc: 'Connect triggers and operations with 5,000+ online tools in your workflows.',
                    placeholder: 'Enter Zapier integration secret',
                    iconBg: 'bg-orange-500/10 text-orange-600',
                    icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></svg>,
                  },
                  {
                    name: 'hubspot',
                    label: 'HubSpot Integration',
                    desc: 'Sync contact cards and deals dynamically with HubSpot pipeline modules.',
                    placeholder: 'pat-na1-...',
                    iconBg: 'bg-orange-600/10 text-orange-700',
                    icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
                  },
                  {
                    name: 'salesforce',
                    label: 'Salesforce API Access',
                    desc: 'Integrate custom interactions, deal updates, and call metadata inside Salesforce sales cloud.',
                    placeholder: 'Salesforce token string',
                    iconBg: 'bg-sky-500/10 text-sky-600',
                    icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /><path d="M2 12h20" /></svg>,
                  },
                ].map(item => {
                  const isConnected = tenant?.settings?.integrations?.[item.name]?.connected;
                  const isEditing = editingIntegration === item.name;

                  return (
                    <div key={item.name} className="p-5 border border-border rounded-xl bg-card hover:bg-accent/10 transition-all flex flex-col md:flex-row md:items-start gap-4 shadow-sm">
                      <div className={`w-12 h-12 rounded-lg ${item.iconBg} flex items-center justify-center flex-shrink-0`}>
                        {item.icon}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-foreground">{item.label}</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">{item.desc}</p>
                          </div>
                          {!isEditing && (
                            <div className="flex items-center gap-2">
                              {isConnected ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Connected
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">
                                  Disconnected
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="pt-2 space-y-3">
                            <div>
                              <label className="block text-xs font-semibold text-foreground mb-1">Credential String / API Endpoint Link</label>
                              <input
                                type="text"
                                value={(integrationsForm as any)[item.name] || ''}
                                onChange={e => setIntegrationsForm(f => ({ ...f, [item.name]: e.target.value }))}
                                placeholder={item.placeholder}
                                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setEditingIntegration(null)}
                                className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleIntegrationSave(item.name)}
                                disabled={integrationSaving}
                                className="h-8 px-4 rounded-lg gradient-primary text-white text-xs font-medium hover:opacity-90 flex items-center gap-1.5"
                              >
                                {integrationSaving && <div className="w-3.5 h-3.5 rounded-full border border-white/30 border-t-white animate-spin" />}
                                Save Connection
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2 flex justify-end gap-2">
                            {isConnected ? (
                              <>
                                <button
                                  onClick={() => setEditingIntegration(item.name)}
                                  className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent"
                                >
                                  Edit Credentials
                                </button>
                                <button
                                  onClick={() => handleIntegrationDisconnect(item.name)}
                                  disabled={integrationSaving}
                                  className="h-8 px-3 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-500 hover:bg-rose-500/10 text-xs font-medium"
                                >
                                  Disconnect
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setEditingIntegration(item.name)}
                                className="h-8 px-4 rounded-lg gradient-primary text-white text-xs font-medium hover:opacity-90"
                              >
                                Connect Configuration
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Notifications Settings ── */}
          {activeTab === 'notifications' && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">Notification Preferences</h2>

              {notificationsSuccess && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  {notificationsSuccess}
                </div>
              )}
              {notificationsError && (
                <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{notificationsError}</div>
              )}

              <div className="space-y-4">
                {[
                  {
                    key: 'newCall',
                    title: 'New Video Call Alerts',
                    description: 'Receive email alerts the moment an inbound visitor starts ringing or queues up.',
                  },
                  {
                    key: 'newLead',
                    title: 'New Captured Lead Alerts',
                    description: 'Notify agent members immediately via email when a visitor fills out any lead form.',
                  },
                  {
                    key: 'weeklyReport',
                    title: 'Weekly Performance Reports',
                    description: 'Get weekly summaries showing metrics, analytics charts, minutes used, and streams count.',
                  },
                  {
                    key: 'billingAlerts',
                    title: 'Billing & Quota Alerts',
                    description: 'Be notified when you are approaching usage thresholds, limits, or on payment invoice generation.',
                  },
                ].map(item => (
                  <label key={item.key} className="flex items-start gap-4 p-4 border border-border rounded-xl cursor-pointer hover:bg-accent/20 transition-all select-none">
                    <input
                      type="checkbox"
                      checked={(notificationsForm as any)[item.key]}
                      onChange={e => setNotificationsForm(f => ({ ...f, [item.key]: e.target.checked }))}
                      className="mt-1 w-4.5 h-4.5 text-primary border-input rounded focus:ring-primary/50 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground text-sm">{item.title}</div>
                      <div className="text-xs text-muted-foreground leading-relaxed">{item.description}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end pt-4 border-t border-border">
                <button
                  onClick={handleNotificationsSave}
                  disabled={notificationsSaving}
                  className="px-6 py-2.5 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {notificationsSaving && <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                  {notificationsSaving ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}

          {/* ── API Keys Settings ── */}
          {activeTab === 'apikeys' && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-6 shadow-sm">
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">API Keys</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Generate API Keys to access the SaleAssist.ai API securely.</p>
                </div>
                <button
                  onClick={() => {
                    setCreatedKeyRaw(null);
                    setNewKeyName('');
                    setApiKeyError('');
                    setIsCreateKeyModalOpen(true);
                  }}
                  className="px-4 py-2 gradient-primary text-white text-sm font-medium rounded-lg hover:opacity-90 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Generate Key
                </button>
              </div>

              {apiKeySuccess && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  {apiKeySuccess}
                </div>
              )}
              {apiKeyError && (
                <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{apiKeyError}</div>
              )}

              {apiKeysLoading && apiKeys.length === 0 ? (
                <div className="flex justify-center items-center py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-border rounded-xl">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">No API Keys</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">Generate a key to securely integrate developer modules or fetch CRM streams data.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-border rounded-lg bg-card">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border text-muted-foreground font-medium">
                        <th className="p-3">Name</th>
                        <th className="p-3">Prefix</th>
                        <th className="p-3">Permissions</th>
                        <th className="p-3">Created At</th>
                        <th className="p-3 text-right">Revoke</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-foreground">
                      {apiKeys.map(key => (
                        <tr key={key.id} className="hover:bg-accent/20 transition-all">
                          <td className="p-3 font-medium">{key.name}</td>
                          <td className="p-3"><code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">{key.keyPrefix}...</code></td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/10 text-indigo-500 font-medium">
                              {key.permissions?.join(', ') || '*'}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground text-xs">{new Date(key.createdAt).toLocaleDateString()}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleRevokeApiKey(key.id)}
                              className="p-1 rounded hover:bg-rose-500/10 text-rose-500 transition-all"
                              title="Revoke Key"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Generate Key Modal */}
              {isCreateKeyModalOpen && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-foreground">Generate New API Key</h3>
                        <button
                          onClick={() => {
                            setIsCreateKeyModalOpen(false);
                            setCreatedKeyRaw(null);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </div>

                      {createdKeyRaw ? (
                        <div className="space-y-4">
                          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs leading-relaxed">
                            <strong>API Key generated successfully!</strong> Make sure to copy this token now. For security purposes, you will not be able to view it again.
                          </div>
                          <div className="space-y-2">
                            <label className="block text-xs font-semibold text-muted-foreground">API Token Secret</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                readOnly
                                value={createdKeyRaw}
                                className="flex-1 h-9 px-3 rounded-lg border border-input bg-muted/30 text-sm font-mono text-foreground focus:outline-none"
                              />
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(createdKeyRaw);
                                  alert('Copied to clipboard!');
                                }}
                                className="h-9 px-3 bg-accent border border-border text-foreground hover:bg-accent/80 text-xs font-semibold rounded-lg"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                          <div className="pt-2 flex justify-end">
                            <button
                              onClick={() => {
                                setIsCreateKeyModalOpen(false);
                                setCreatedKeyRaw(null);
                              }}
                              className="px-4 py-2 gradient-primary text-white text-xs font-semibold rounded-lg hover:opacity-90"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Key Name *</label>
                            <input
                              type="text"
                              value={newKeyName}
                              onChange={e => setNewKeyName(e.target.value)}
                              placeholder="e.g. Production CRM Server"
                              className="w-full h-10 px-4 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Permissions Type</label>
                            <select
                              value={newKeyPermissions[0]}
                              onChange={e => setNewKeyPermissions([e.target.value])}
                              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none"
                            >
                              <option value="*">Full Access (*)</option>
                              <option value="read:crm">CRM Read-Only</option>
                              <option value="write:crm">CRM Full Access</option>
                              <option value="read:widget">Widget Configurations</option>
                            </select>
                          </div>

                          <div className="flex gap-2 justify-end pt-2">
                            <button
                              onClick={() => setIsCreateKeyModalOpen(false)}
                              className="h-9 px-4 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-accent"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleCreateApiKey}
                              disabled={apiKeysLoading}
                              className="h-9 px-5 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90 flex items-center gap-1.5"
                            >
                              {apiKeysLoading && <div className="w-3.5 h-3.5 rounded-full border border-white/30 border-t-white animate-spin" />}
                              Generate Token
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Danger Zone Settings ── */}
          {activeTab === 'danger' && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 space-y-6 shadow-sm">
              <h2 className="text-lg font-semibold text-rose-500 flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                Danger Zone
              </h2>

              {!isOwner ? (
                <div className="p-4 border border-rose-200 dark:border-rose-950 bg-rose-100/10 text-rose-700 dark:text-rose-400 text-sm rounded-lg leading-relaxed">
                  <strong>Access Restricted:</strong> You must be the <strong>Organization Owner</strong> (Tenant Owner) to request deletions or perform destructive processes.
                </div>
              ) : (
                <>
                  <div className="p-4 border border-rose-200 dark:border-rose-950 bg-rose-100/15 text-rose-800 dark:text-rose-300 text-sm rounded-lg leading-relaxed space-y-2">
                    <p className="font-semibold">Permanently Delete this Organization</p>
                    <p className="text-xs text-rose-700 dark:text-rose-400">
                      Once deleted, all database schemas, team memberships, analytics graphs, shoppable videos, and live CRM modules will be permanently purged. This action is irreversible.
                    </p>
                  </div>

                  {dangerSuccess && (
                    <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">{dangerSuccess}</div>
                  )}
                  {dangerError && (
                    <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{dangerError}</div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        To confirm deletion, please enter the name of your organization: <span className="font-semibold text-rose-600">{(tenant?.name) || '...' }</span>
                      </label>
                      <input
                        type="text"
                        value={confirmOrgName}
                        onChange={e => setConfirmOrgName(e.target.value)}
                        placeholder="Type organization name..."
                        className="w-full h-10 px-4 rounded-lg border border-rose-500/20 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-rose-500/20">
                    <button
                      onClick={handleDeleteTenant}
                      disabled={confirmOrgName !== tenant?.name || isDeleting}
                      className="px-6 py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 shadow"
                    >
                      {isDeleting && <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                      Permanently Delete Organization
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

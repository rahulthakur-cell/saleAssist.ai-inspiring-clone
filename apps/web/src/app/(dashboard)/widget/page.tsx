'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import {
  Code,
  Copy,
  Check,
  Settings,
  Palette,
  Eye,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { widgetApi } from '@/lib/api-client';

export default function WidgetPage() {
  const { user } = useAuthStore();
  const tenantId = user?.currentTenant?.id || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Widget config states
  const [name, setName] = useState('Default Widget');
  const [isActive, setIsActive] = useState(true);
  const [position, setPosition] = useState('BOTTOM_RIGHT');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [secondaryColor, setSecondaryColor] = useState('#8b5cf6');
  const [borderRadius, setBorderRadius] = useState(16);
  const [greeting, setGreeting] = useState('Hi! How can we help you?');
  const [enableVideoCall, setEnableVideoCall] = useState(true);
  const [enableChat, setEnableChat] = useState(true);
  const [enableShoppable, setEnableShoppable] = useState(true);
  const [enableFaq, setEnableFaq] = useState(true);

  // Live preview inside simulated page
  const [previewOpen, setPreviewOpen] = useState(false);

  const apiBase = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : 'http://localhost:4000';
  const embedCode = `<script src="${apiBase}/api/v1/widget/embed?tenantId=${tenantId || 'YOUR_TENANT_ID'}"></script>`;

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await widgetApi.getConfig();
      if (res) {
        setName(res.name);
        setIsActive(res.isActive);
        setPosition(res.position);
        setPrimaryColor(res.primaryColor);
        setSecondaryColor(res.secondaryColor);
        setBorderRadius(res.borderRadius);
        setGreeting(res.greeting);
        setEnableVideoCall(res.enableVideoCall);
        setEnableChat(res.enableChat);
        setEnableShoppable(res.enableShoppable);
        setEnableFaq(res.enableFaq);
      }
    } catch {
      toast.error('Failed to load widget configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast.success('Embed script copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await widgetApi.updateConfig({
        name,
        isActive,
        position,
        primaryColor,
        secondaryColor,
        borderRadius,
        greeting,
        enableVideoCall,
        enableChat,
        enableShoppable,
        enableFaq,
      });
      toast.success('Widget configuration saved successfully!');
    } catch {
      toast.error('Failed to save widget configurations');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="w-8 h-8 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-card border border-border">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Code className="w-6 h-6 text-indigo-500" />
          Widget Configuration
        </h1>
        <p className="text-muted-foreground mt-1">
          Customize colors, toggles, and obtain the JavaScript embed code for your e-commerce store.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel: Settings Form */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
          {/* General customization cards */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-3 border-b border-border/60">
              <Sliders className="w-4 h-4 text-indigo-500" />
              General Settings
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Widget Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Widget Position</label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:border-indigo-500"
                >
                  <option value="BOTTOM_RIGHT">Bottom Right</option>
                  <option value="BOTTOM_LEFT">Bottom Left</option>
                  <option value="TOP_RIGHT">Top Right</option>
                  <option value="TOP_LEFT">Top Left</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Default Welcome Message</label>
              <input
                type="text"
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                placeholder="e.g. Hi! How can we help you today?"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-muted/40 border border-border rounded-xl">
              <div>
                <span className="text-xs font-bold text-foreground">Widget Status</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">Toggle script visibility on your website</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          {/* Color theme cards */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-3 border-b border-border/60">
              <Palette className="w-4 h-4 text-indigo-500" />
              Theme Customization
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Primary Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-border rounded-lg bg-background text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Secondary Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-border rounded-lg bg-background text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Border Radius (px)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="28"
                  value={borderRadius}
                  onChange={(e) => setBorderRadius(Number(e.target.value))}
                  className="flex-1 accent-indigo-500 h-1.5 bg-muted rounded-full cursor-pointer"
                />
                <span className="text-xs font-mono w-8 text-right font-medium">{borderRadius}px</span>
              </div>
            </div>
          </div>

          {/* Toggles settings */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-3 border-b border-border/60">
              <Settings className="w-4 h-4 text-indigo-500" />
              Enabled Channels
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-muted/20">
                <span className="text-xs font-semibold text-foreground">AI Chat Bot</span>
                <input
                  type="checkbox"
                  checked={enableChat}
                  onChange={(e) => setEnableChat(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
              </div>

              <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-muted/20">
                <span className="text-xs font-semibold text-foreground">Live Video Calls</span>
                <input
                  type="checkbox"
                  checked={enableVideoCall}
                  onChange={(e) => setEnableVideoCall(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
              </div>

              <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-muted/20">
                <span className="text-xs font-semibold text-foreground">Shoppable Video</span>
                <input
                  type="checkbox"
                  checked={enableShoppable}
                  onChange={(e) => setEnableShoppable(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
              </div>

              <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-muted/20">
                <span className="text-xs font-semibold text-foreground">Video FAQs</span>
                <input
                  type="checkbox"
                  checked={enableFaq}
                  onChange={(e) => setEnableFaq(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full h-11 text-white text-sm font-semibold rounded-xl gradient-primary hover:opacity-95 disabled:opacity-50 shadow-lg shadow-indigo-500/20 transition-all"
          >
            {saving ? 'Saving Configurations...' : 'Save Configuration'}
          </button>
        </form>

        {/* Right Panel: Embed Code & Preview */}
        <div className="lg:col-span-5 space-y-6">
          {/* Embed code snippet */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-2">
              <Code className="w-4 h-4 text-indigo-500" />
              Embed Code Snippet
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Copy and paste this loader script tag before the closing <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px]">&lt;/body&gt;</code> element on your html template.
            </p>

            <div className="relative group">
              <pre className="p-4 rounded-xl bg-muted text-xs font-mono text-foreground overflow-x-auto border border-border/80 break-all select-all">
                {embedCode}
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-2.5 right-2.5 p-2 rounded-lg bg-zinc-900 border border-border hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                title="Copy Code"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Interactive Preview Container */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-indigo-500" />
              Live Visual Preview
            </h3>

            {/* Browser simulator */}
            <div className="border border-border rounded-xl h-80 bg-zinc-900 relative overflow-hidden flex flex-col justify-between">
              {/* Browser Address Bar */}
              <div className="flex items-center gap-2 p-2 bg-zinc-950 border-b border-border text-[10px] text-zinc-500 select-none">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500/60" />
                  <span className="w-2 h-2 rounded-full bg-yellow-500/60" />
                  <span className="w-2 h-2 rounded-full bg-green-500/60" />
                </div>
                <div className="flex-1 bg-zinc-900 text-center rounded py-0.5 border border-zinc-800/80 truncate">
                  my-shopify-store.com
                </div>
              </div>

              {/* Simulated client website content */}
              <div className="p-4 text-center space-y-2 flex-1 flex flex-col justify-center items-center">
                <h4 className="font-bold text-xs text-zinc-400">Welcome to Vintage Store</h4>
                <p className="text-[10px] text-zinc-600 max-w-[200px] leading-relaxed">
                  Hover over the launcher bubble on the side to preview welcome greeting tooltips and toggle panel slides!
                </p>
              </div>

              {/* Simulated Floating Iframe Drawer panel */}
              {previewOpen && (
                <div
                  className="absolute bottom-18 w-[220px] h-[190px] bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col justify-between"
                  style={{
                    borderRadius: `${borderRadius}px`,
                    right: position.includes('RIGHT') ? '16px' : 'auto',
                    left: position.includes('LEFT') ? '16px' : 'auto',
                  }}
                >
                  <div className="p-3 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60">
                    <span className="text-[10px] font-bold text-zinc-200">Interactive Support</span>
                    <X className="w-3.5 h-3.5 text-zinc-500 cursor-pointer" onClick={() => setPreviewOpen(false)} />
                  </div>
                  <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-center text-center">
                    <span className="text-[10px] text-zinc-400">{greeting}</span>
                    <div className="flex justify-center gap-2 pt-1">
                      {enableChat && <span className="w-5 h-5 rounded bg-zinc-800 text-[8px] flex items-center justify-center border border-zinc-700">Chat</span>}
                      {enableVideoCall && <span className="w-5 h-5 rounded bg-zinc-800 text-[8px] flex items-center justify-center border border-zinc-700">Call</span>}
                      {enableShoppable && <span className="w-5 h-5 rounded bg-zinc-800 text-[8px] flex items-center justify-center border border-zinc-700">Videos</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Tooltip greeting preview (renders when not open) */}
              {!previewOpen && (
                <div
                  className="absolute bottom-18 bg-zinc-950 border border-zinc-800 text-[9px] text-zinc-300 px-2.5 py-1.5 rounded-lg shadow-xl"
                  style={{
                    right: position.includes('RIGHT') ? '16px' : 'auto',
                    left: position.includes('LEFT') ? '16px' : 'auto',
                  }}
                >
                  {greeting}
                </div>
              )}

              {/* Floating Launcher bubble */}
              {isActive && (
                <div
                  onClick={() => setPreviewOpen(!previewOpen)}
                  className="absolute bottom-4 w-11 h-11 rounded-full cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/45"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                    right: position.includes('RIGHT') ? '16px' : 'auto',
                    left: position.includes('LEFT') ? '16px' : 'auto',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

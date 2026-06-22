'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Image, Film, FileText, Music, HardDrive, ExternalLink } from 'lucide-react';
import { videoCallApi } from '@/lib/api-client';

type VideoCallAsset = {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document' | 'audio' | 'other';
  url: string;
  sizeBytes?: number;
  durationSec?: number;
  createdAt: string;
  source: 'recording' | 'chat';
  senderName?: string;
  callId?: string;
  callName?: string;
};

type AssetFilter = 'all' | 'image' | 'video' | 'pdf' | 'document' | 'audio' | 'other';

const assetFilters: Array<{ value: AssetFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'pdf', label: 'PDF' },
  { value: 'document', label: 'Docs' },
  { value: 'audio', label: 'Audio' },
  { value: 'other', label: 'Other' },
];

function formatBytes(bytes?: number) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function getDisplayType(asset: VideoCallAsset): Exclude<AssetFilter, 'all'> {
  if (asset.name.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (asset.type === 'image' || asset.type === 'video' || asset.type === 'audio' || asset.type === 'other') return asset.type;
  return 'document';
}

function getIcon(type: Exclude<AssetFilter, 'all'>) {
  if (type === 'image') return <Image className="w-4 h-4" />;
  if (type === 'video') return <Film className="w-4 h-4" />;
  if (type === 'audio') return <Music className="w-4 h-4" />;
  if (type === 'document') return <FileText className="w-4 h-4" />;
  if (type === 'other') return <HardDrive className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
}

export default function AssetsPage() {
  const [filter, setFilter] = useState<AssetFilter>('all');
  const [assets, setAssets] = useState<VideoCallAsset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAssets = async () => {
      try {
        setLoading(true);
        const result = await videoCallApi.listAssets(filter === 'all' ? undefined : filter);
        if (!cancelled) setAssets(result.assets || []);
      } catch (err: any) {
        console.error('Failed to load assets', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAssets();
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const filteredAssets = assets.filter((asset) => {
    const displayType = getDisplayType(asset);
    return filter === 'all' || displayType === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground">Assets</h1>
        <p className="text-sm text-muted-foreground">
          View images, videos, PDFs, documents and other media stored in MinIO.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2">
        {assetFilters.map((assetFilter) => (
          <button
            key={assetFilter.value}
            type="button"
            onClick={() => setFilter(assetFilter.value)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              filter === assetFilter.value
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {assetFilter.value === 'all' ? null : getIcon(assetFilter.value)}
            {assetFilter.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Preview</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Call</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Loading assets...
                  </td>
                </tr>
              ) : filteredAssets.length > 0 ? (
                filteredAssets.map((asset) => {
                  const displayType = getDisplayType(asset);
                  return (
                    <tr key={`${asset.id}-${displayType}`} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden">
                          {displayType === 'image' ? (
                            <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                          ) : displayType === 'video' ? (
                            <video src={asset.url} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-violet-500">{getIcon(displayType)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground truncate max-w-[240px]">{asset.name}</div>
                        <div className="text-xs text-muted-foreground">{asset.senderName || asset.source}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-foreground capitalize">
                          {getIcon(displayType)}
                          {displayType}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {asset.callId ? (
                          <Link href={`/video-calls/${asset.callId}`} className="text-violet-500 hover:text-violet-400 font-medium">
                            {asset.callName || 'Open call'}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatBytes(asset.sizeBytes)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(asset.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={asset.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-violet-500 hover:text-violet-400 font-medium"
                        >
                          Open <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No assets found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Video,
  Plus,
  Play,
  Eye,
  Sparkles,
  X,
  FileVideo,
  Upload,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { shoppableVideoApi, storageApi } from '@/lib/api-client';

interface VideoAsset {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  status: string;
  displayType: string;
  views: number;
  clicks: number;
  conversions: number;
  createdAt: string;
}

export default function ShoppableVideosPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Create video form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [displayType, setDisplayType] = useState('carousel');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const res = await shoppableVideoApi.list(20, 1);
      setVideos(res.data || []);
    } catch {
      toast.error('Failed to load videos list');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shoppable video? This action is permanent.')) return;
    try {
      await shoppableVideoApi.delete(id);
      toast.success('Shoppable video deleted successfully');
      fetchVideos();
    } catch {
      toast.error('Failed to delete shoppable video');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        toast.error('Please select a valid video file');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !selectedFile) {
      toast.error('Title and Video file are required');
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    try {
      // 1. Get presigned upload URL from S3 API
      const presignedRes = await storageApi.getPresignedUrl(
        selectedFile.name,
        selectedFile.type,
      );

      setUploadProgress(30);

      // 2. Direct upload to MinIO S3 bucket via PUT
      const uploadRes = await fetch(presignedRes.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': selectedFile.type,
        },
        body: selectedFile,
      });

      if (!uploadRes.ok) {
        throw new Error('Direct S3 upload failed');
      }

      setUploadProgress(70);

      // 3. Register video URL in our Database
      await shoppableVideoApi.create({
        title,
        description: description || undefined,
        videoUrl: (presignedRes as any).streamUrl || presignedRes.publicUrl,
        displayType,
      });

      setUploadProgress(100);
      toast.success('Shoppable Video uploaded! Processing background transcoding queue.');
      
      setShowModal(false);
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      setUploadProgress(0);
      
      fetchVideos();
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload shoppable video');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl bg-card border border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Shoppable Videos</h1>
          <p className="text-muted-foreground mt-1">
            Configure interactively tagged product hotspot videos.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white gradient-primary hover:opacity-95 shadow-md shadow-violet-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Shoppable Video
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="w-8 h-8 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-500">
            <Video className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No Videos Cataloged</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Upload product videos, add temporal hotspot links, and showcase them in your site embed widget.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg shadow-lg shadow-violet-500/10 transition-all"
          >
            Upload Video
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((vid) => (
            <div
              key={vid.id}
              onClick={() => router.push(`/shoppable-videos/${vid.id}`)}
              className="group rounded-2xl border border-border bg-card overflow-hidden flex flex-col justify-between cursor-pointer hover:border-violet-500/50 transition-all"
            >
              {/* Thumbnail / Status */}
              <div className="aspect-video bg-zinc-900 relative flex items-center justify-center overflow-hidden">
                {vid.thumbnailUrl ? (
                  <img
                    src={vid.thumbnailUrl}
                    alt={vid.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <FileVideo className="w-12 h-12 text-zinc-700" />
                )}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm text-white">
                    <Play className="w-6 h-6 fill-current" />
                  </div>
                </div>
                
                <span className={`absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  vid.status === 'PUBLISHED'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-zinc-500/20 text-zinc-400'
                }`}>
                  {vid.status}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteVideo(vid.id);
                  }}
                  className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 hover:bg-rose-600 text-white hover:text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all shadow-md duration-200"
                  title="Delete Video"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Title & Description */}
              <div className="p-5 space-y-3">
                <div>
                  <h3 className="font-bold text-foreground line-clamp-1">{vid.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{vid.description || 'No description.'}</p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-3 border-t border-border/60">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-violet-500" /> {vid.views} Views
                  </span>
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-violet-500" /> {vid.conversions} Conversions
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 bg-card border border-border rounded-2xl shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Video className="w-5 h-5 text-violet-500" />
                Upload Shoppable Video
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadAndSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Video Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vintage Leather Jacket Walkthrough"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <textarea
                  placeholder="Summarize product video content for search catalogs..."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Layout Type</label>
                  <select
                    value={displayType}
                    onChange={(e) => setDisplayType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-violet-500"
                  >
                    <option value="carousel">Carousel Slide</option>
                    <option value="hero">Hero Feature</option>
                    <option value="story">Story Format</option>
                  </select>
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="relative flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-border rounded-lg text-xs font-semibold hover:bg-muted text-foreground cursor-pointer transition-all">
                    <Upload className="w-4 h-4 text-violet-500" />
                    {selectedFile ? 'Change File' : 'Select MP4'}
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {selectedFile && (
                <div className="p-3.5 rounded-xl border border-violet-500/10 bg-violet-500/5 text-xs text-foreground flex items-center justify-between">
                  <span className="truncate max-w-[200px] font-medium">{selectedFile.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {Math.round(selectedFile.size / (1024 * 1024))} MB
                  </span>
                </div>
              )}

              {uploading && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-border rounded-lg text-sm font-semibold hover:bg-muted text-foreground transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-2.5 rounded-lg text-white font-semibold text-sm gradient-primary hover:opacity-95 disabled:opacity-50 transition-all"
                >
                  {uploading ? 'Processing...' : 'Upload Video'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import {
  HelpCircle,
  Video,
  Plus,
  Play,
  Trash2,
  X,
  Upload,
  FolderPlus,
  ChevronDown,
  ChevronUp,
  FileVideo,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { videoFaqApi, storageApi } from '@/lib/api-client';

interface FaqItem {
  id: string;
  faqId: string;
  question: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  createdAt: string;
}

interface FaqCollection {
  id: string;
  title: string;
  description?: string;
  status: string;
  items: FaqItem[];
  createdAt: string;
}

export default function VideoFaqPage() {
  const [collections, setCollections] = useState<FaqCollection[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  // New Collection Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creatingCollection, setCreatingCollection] = useState(false);

  // New Item Form State
  const [questionText, setQuestionText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Accordion/Expanded states for collections
  const [expandedCollections, setExpandedCollections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchFaqs();
  }, []);

  const fetchFaqs = async () => {
    try {
      const res = await videoFaqApi.list();
      setCollections(res || []);
      // Auto expand first collection if any
      if (res && res.length > 0) {
        setExpandedCollections((prev) => ({
          [res[0].id]: true,
          ...prev,
        }));
      }
    } catch {
      toast.error('Failed to load Video FAQ collections');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedCollections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) {
      toast.error('Collection title is required');
      return;
    }

    setCreatingCollection(true);
    try {
      await videoFaqApi.create({
        title: newTitle,
        description: newDescription || undefined,
      });
      toast.success('Video FAQ Playlist created!');
      setShowCollectionModal(false);
      setNewTitle('');
      setNewDescription('');
      fetchFaqs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create collection');
    } finally {
      setCreatingCollection(false);
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

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCollectionId) return;

    if (!questionText || !selectedFile) {
      toast.error('Question text and Video response file are required');
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

      // 3. Register Video FAQ Item in our Database
      await videoFaqApi.addItem(activeCollectionId, {
        question: questionText,
        videoUrl: presignedRes.publicUrl,
      });

      setUploadProgress(100);
      toast.success('Question added to FAQ playlist!');
      
      setShowItemModal(false);
      setQuestionText('');
      setSelectedFile(null);
      setUploadProgress(0);
      
      fetchFaqs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add FAQ question');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteCollection = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this FAQ playlist and all its video questions?')) {
      return;
    }

    try {
      await videoFaqApi.delete(id);
      toast.success('FAQ Playlist deleted');
      fetchFaqs();
    } catch {
      toast.error('Failed to delete playlist');
    }
  };

  const handleDeleteItem = async (faqId: string, itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this question response?')) {
      return;
    }

    try {
      await videoFaqApi.deleteItem(faqId, itemId);
      toast.success('Question deleted');
      fetchFaqs();
    } catch {
      toast.error('Failed to delete question');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl bg-card border border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Video FAQ Playlists</h1>
          <p className="text-muted-foreground mt-1">
            Build interactive video FAQ response collections for widget playback.
          </p>
        </div>

        <button
          onClick={() => setShowCollectionModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white gradient-primary hover:opacity-95 shadow-md shadow-violet-500/20 transition-all"
        >
          <FolderPlus className="w-4 h-4" />
          Create Playlist
        </button>
      </div>

      {/* Playlists Accordion List */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="w-8 h-8 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
        </div>
      ) : collections.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-500">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No Playlists Found</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Create FAQ playlists (e.g. "Pricing & Plans", "Return Policies") and attach short recorded video answers.
          </p>
          <button
            onClick={() => setShowCollectionModal(true)}
            className="mt-6 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg shadow-lg shadow-violet-500/10 transition-all"
          >
            Create First Playlist
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {collections.map((col) => {
            const isExpanded = !!expandedCollections[col.id];
            return (
              <div
                key={col.id}
                className="rounded-2xl border border-border bg-card overflow-hidden transition-all duration-200"
              >
                {/* Playlist Header */}
                <div
                  onClick={() => toggleExpand(col.id)}
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{col.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {col.description || 'No description provided.'} • {col.items.length} questions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCollectionId(col.id);
                        setShowItemModal(true);
                      }}
                      className="p-2 text-violet-500 hover:bg-violet-500/10 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Add Question
                    </button>
                    <button
                      onClick={(e) => handleDeleteCollection(col.id, e)}
                      className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                    <div className="text-muted-foreground ml-2">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Playlist Questions Grid */}
                {isExpanded && (
                  <div className="p-5 border-t border-border bg-background/40">
                    {col.items.length === 0 ? (
                      <div className="py-8 text-center">
                        <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/60 mb-2" />
                        <p className="text-sm text-muted-foreground">No questions cataloged in this playlist yet.</p>
                        <button
                          onClick={() => {
                            setActiveCollectionId(col.id);
                            setShowItemModal(true);
                          }}
                          className="mt-3 inline-flex items-center gap-1 text-xs text-violet-500 font-semibold hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add one now
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {col.items.map((item) => (
                          <div
                            key={item.id}
                            className="group relative rounded-xl border border-border bg-card overflow-hidden hover:border-violet-500/40 transition-all flex flex-col justify-between"
                          >
                            {/* Video Thumbnail area */}
                            <div
                              onClick={() => setActiveVideoUrl(item.videoUrl)}
                              className="aspect-video bg-zinc-900 relative cursor-pointer flex items-center justify-center"
                            >
                              {item.thumbnailUrl ? (
                                <img
                                  src={item.thumbnailUrl}
                                  alt={item.question}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <FileVideo className="w-10 h-10 text-zinc-700" />
                              )}
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="p-2.5 rounded-full bg-white/20 backdrop-blur-sm text-white">
                                  <Play className="w-5 h-5 fill-current" />
                                </div>
                              </div>
                              <span className="absolute bottom-2 right-2 text-[10px] bg-black/70 text-white px-2 py-0.5 rounded font-mono">
                                0:{item.duration < 10 ? `0${item.duration}` : item.duration}s
                              </span>
                            </div>

                            {/* Content */}
                            <div className="p-4 flex flex-col justify-between flex-1 gap-3">
                              <p className="text-xs font-semibold text-foreground line-clamp-2 pr-6">
                                {item.question}
                              </p>
                              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                                <span className="text-[10px] text-muted-foreground">
                                  Added {new Date(item.createdAt).toLocaleDateString()}
                                </span>
                                <button
                                  onClick={(e) => handleDeleteItem(col.id, item.id, e)}
                                  className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                                  title="Delete Question"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Playlist Create Modal */}
      {showCollectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 bg-card border border-border rounded-2xl shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-violet-500" />
                Create FAQ Playlist
              </h3>
              <button
                onClick={() => setShowCollectionModal(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCollection} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Playlist Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Setup & Customization"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <textarea
                  placeholder="e.g. Help videos showing users how to customize their widget styles..."
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCollectionModal(false)}
                  className="flex-1 py-2.5 border border-border rounded-lg text-sm font-semibold hover:bg-muted text-foreground transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCollection}
                  className="flex-1 py-2.5 rounded-lg text-white font-semibold text-sm gradient-primary hover:opacity-95 disabled:opacity-50 transition-all"
                >
                  {creatingCollection ? 'Creating...' : 'Create Playlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Question Add Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 bg-card border border-border rounded-2xl shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-violet-500" />
                Add FAQ Video Question
              </h3>
              <button
                onClick={() => setShowItemModal(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Question Text *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. How do I change the default widgets color scheme?"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Upload Answer Video *</label>
                <div className="flex flex-col justify-end">
                  <label className="relative flex items-center justify-center gap-1.5 py-3 border border-dashed border-border rounded-lg text-xs font-semibold hover:bg-muted text-foreground cursor-pointer transition-all">
                    <Upload className="w-4.5 h-4.5 text-violet-500" />
                    {selectedFile ? 'Change Response File' : 'Select Response MP4 File'}
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
                <div className="p-3 rounded-xl border border-violet-500/10 bg-violet-500/5 text-xs text-foreground flex items-center justify-between">
                  <span className="truncate max-w-[200px] font-medium">{selectedFile.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {Math.round(selectedFile.size / (1024 * 1024))} MB
                  </span>
                </div>
              )}

              {uploading && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Uploading to Storage...</span>
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
                  onClick={() => setShowItemModal(false)}
                  className="flex-1 py-2.5 border border-border rounded-lg text-sm font-semibold hover:bg-muted text-foreground transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-2.5 rounded-lg text-white font-semibold text-sm gradient-primary hover:opacity-95 disabled:opacity-50 transition-all"
                >
                  {uploading ? 'Uploading...' : 'Save Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Video Overlay Player */}
      {activeVideoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md"
          onClick={() => setActiveVideoUrl(null)}
        >
          <div
            className="relative w-full max-w-2xl aspect-video bg-black rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveVideoUrl(null)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <video
              src={activeVideoUrl}
              controls
              autoPlay
              onError={(e) => {
                const target = e.currentTarget;
                if (target.error?.code) {
                  console.warn('Video FAQ player error:', target.error.message);
                }
              }}
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

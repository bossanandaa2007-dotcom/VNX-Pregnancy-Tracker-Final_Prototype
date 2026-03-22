import { useMemo, useState } from 'react';
import { Dumbbell, Pencil, PlayCircle, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { libraryApi } from '@/lib/libraryApi';
import { extractYouTubeId, fetchYouTubeMetadata, getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from '@/lib/libraryEmbeds';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { LibraryFitnessItem } from '@/types/library';

interface FitnessSectionProps {
  items: LibraryFitnessItem[];
  loading?: boolean;
  canManage?: boolean;
  onCreated?: (item: LibraryFitnessItem) => void;
  onUpdated?: (item: LibraryFitnessItem) => void;
  onDeleted?: (itemId: string) => void;
}

const categoryOptions = ['All', 'First Trimester', 'Second Trimester', 'Third Trimester'] as const;

const normalizeCategory = (value: string) => {
  const raw = value.trim().toLowerCase();
  if (raw.includes('first')) return 'First Trimester';
  if (raw.includes('second')) return 'Second Trimester';
  if (raw.includes('third')) return 'Third Trimester';
  return 'General';
};

export function FitnessSection({
  items,
  loading = false,
  canManage = false,
  onCreated,
  onUpdated,
  onDeleted,
}: FitnessSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<(typeof categoryOptions)[number]>('All');
  const [selectedVideo, setSelectedVideo] = useState<LibraryFitnessItem | null>(null);
  const [editingItem, setEditingItem] = useState<LibraryFitnessItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('General');

  const sortedItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (selectedCategory === 'All') return true;
      return normalizeCategory(item.category || item.trimester || 'General') === selectedCategory;
    });

    return filtered.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      if (a.isDefault && b.isDefault) {
        return new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime();
      }
      return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
    });
  }, [items, selectedCategory]);

  const resetForm = () => {
    setYoutubeUrl('');
    setTitle('');
    setDescription('');
    setCategory('General');
  };

  const isDoctorOwnedItem = (item: LibraryFitnessItem) =>
    String(item.doctorId || '') === String(user?.id || '');

  const canEditItem = (item: LibraryFitnessItem) =>
    canManage &&
    (item.isDefault || item.sourceType === 'fitness_seed' || isDoctorOwnedItem(item));

  const handleCreate = async () => {
    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
      toast({
        title: 'Invalid YouTube URL',
        description: 'Please enter a valid YouTube watch or share link.',
        variant: 'destructive',
      });
      return;
    }

    let resolvedTitle = title.trim();
    const resolvedCategory = normalizeCategory(category);

    if (!resolvedTitle) {
      try {
        const metadata = await fetchYouTubeMetadata(youtubeUrl);
        resolvedTitle = metadata.title || 'Pregnancy Fitness Video';
      } catch {
        resolvedTitle = 'Pregnancy Fitness Video';
      }
    }

    setSaving(true);
    try {
      const item = await libraryApi.createFitnessItem({
        doctorId: user?.id || '',
        youtube_url: youtubeUrl.trim(),
        title: resolvedTitle || 'Pregnancy Fitness Video',
        description: description.trim() || 'Recommended by your doctor',
        category: resolvedCategory,
      });
      onCreated?.(item);
      setCreateOpen(false);
      resetForm();
      toast({
        title: 'Fitness video added',
        description: 'The new fitness video is now available in the library.',
      });
    } catch (error) {
      toast({
        title: 'Unable to add video',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (item: LibraryFitnessItem) => {
    setEditingItem(item);
    setEditTitle(item.title || '');
    setEditDescription(item.description || '');
    setEditCategory(normalizeCategory(item.category || item.trimester || 'General'));
  };

  const handleEdit = async () => {
    if (!editingItem) return;

    setSaving(true);
    try {
      const item = await libraryApi.updateFitnessItem({
        itemId: editingItem.id,
        title: editTitle.trim() || 'Pregnancy Fitness Video',
        description: editDescription.trim() || 'Recommended by your doctor',
        category: normalizeCategory(editCategory),
      });
      onUpdated?.(item);
      setEditingItem(null);
      toast({
        title: 'Fitness video updated',
        description: 'The video details were updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    setDeletingId(itemId);
    try {
      await libraryApi.deleteLibraryItem(itemId);
      onDeleted?.(itemId);
      if (selectedVideo?.id === itemId) setSelectedVideo(null);
      toast({
        title: 'Fitness video deleted',
        description: 'The item has been removed from the library.',
      });
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId('');
    }
  };

  return (
    <>
      <Card className="border-0 bg-white/80 shadow-sm backdrop-blur">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                <Dumbbell className="h-5 w-5 text-rose-700" />
                Pregnancy Fitness Videos
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Default YouTube fitness guidance first, then doctor-added videos with in-app playback.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={selectedCategory === value ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() => setSelectedCategory(value)}
                >
                  {value}
                </Button>
              ))}
              {canManage ? (
                <Button type="button" size="sm" className="rounded-full gap-2" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Video
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Loading fitness videos...
            </div>
          ) : null}

          {!loading && sortedItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No fitness videos are available right now.
            </div>
          ) : null}

          {!loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sortedItems.map((item) => {
                const videoId = item.youtubeVideoId || extractYouTubeId(item.youtubeUrl || '');
                const thumbnail = getYouTubeThumbnailUrl(videoId);

                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <button type="button" onClick={() => setSelectedVideo(item)} className="block w-full text-left">
                      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-rose-100 via-amber-50 to-teal-100">
                        {thumbnail ? (
                          <img src={thumbnail} alt={item.title || 'Fitness video'} className="h-full w-full object-cover" />
                        ) : null}
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20">
                          <PlayCircle className="h-12 w-12 text-white" />
                        </div>
                      </div>
                      <div className="space-y-3 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                          <Badge variant="outline">{normalizeCategory(item.category || item.trimester || 'General')}</Badge>
                        </div>
                        <div className="font-semibold text-slate-900">{item.title || 'Pregnancy Fitness Video'}</div>
                        <div className="text-sm text-slate-500">
                          {item.description || 'Recommended by your doctor'}
                        </div>
                      </div>
                    </button>

                    {canEditItem(item) ? (
                      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
                        <Button type="button" variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => openEditDialog(item)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2 rounded-xl text-destructive"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                        >
                          <Trash2 className="h-4 w-4" />
                          {deletingId === item.id ? 'Deleting...' : item.isDefault ? 'Hide' : 'Delete'}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Fitness Video</DialogTitle>
            <DialogDescription>
              Paste a YouTube link. Title will auto-fill from YouTube when possible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="youtube-url">YouTube URL</Label>
              <Input
                id="youtube-url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fitness-title">Title</Label>
              <Input
                id="fitness-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fitness-description">Description</Label>
              <Textarea
                id="fitness-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fitness-category">Category</Label>
              <Input
                id="fitness-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="General / First Trimester / Second Trimester / Third Trimester"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                resetForm();
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} disabled={saving}>
              {saving ? 'Saving...' : 'Save Video'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Fitness Video</DialogTitle>
            <DialogDescription>
              Update the title, description, and category for this fitness video. Changes to default videos apply only to your patient pipeline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-fitness-title">Title</Label>
              <Input id="edit-fitness-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fitness-description">Description</Label>
              <Textarea id="edit-fitness-description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fitness-category">Category</Label>
              <Input id="edit-fitness-category" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingItem(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl rounded-3xl border-0 bg-white">
          {selectedVideo ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedVideo.title || 'Pregnancy Fitness Video'}</DialogTitle>
                <DialogDescription>
                  {selectedVideo.description || 'Recommended by your doctor'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl">
                  <iframe
                    title={selectedVideo.title || 'Pregnancy Fitness Video'}
                    src={getYouTubeEmbedUrl(
                      selectedVideo.youtubeVideoId || extractYouTubeId(selectedVideo.youtubeUrl || '')
                    )}
                    className="aspect-video w-full"
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedVideo.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                  <Badge variant="outline">
                    {normalizeCategory(selectedVideo.category || selectedVideo.trimester || 'General')}
                  </Badge>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

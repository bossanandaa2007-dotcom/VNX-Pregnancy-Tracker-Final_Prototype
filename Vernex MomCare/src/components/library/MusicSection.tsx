import { useEffect, useMemo, useState } from 'react';
import { Music4, Pencil, PlayCircle, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { libraryApi } from '@/lib/libraryApi';
import { extractSpotifyId, fetchSpotifyMetadata, getSpotifyEmbedUrl } from '@/lib/libraryEmbeds';
import type { LibraryMusicItem } from '@/types/library';

interface MusicSectionProps {
  items: LibraryMusicItem[];
  loading?: boolean;
  canManage?: boolean;
  onCreated?: (item: LibraryMusicItem) => void;
  onUpdated?: (item: LibraryMusicItem) => void;
  onDeleted?: (itemId: string) => void;
}

export function MusicSection({
  items,
  loading = false,
  canManage = false,
  onCreated,
  onUpdated,
  onDeleted,
}: MusicSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<LibraryMusicItem | null>(null);
  const [editingItem, setEditingItem] = useState<LibraryMusicItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [thumbnailMap, setThumbnailMap] = useState<Record<string, string>>({});

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      if (a.isDefault && b.isDefault) {
        return new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime();
      }
      return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
    });
  }, [items]);

  const resetCreateForm = () => {
    setSpotifyUrl('');
    setTitle('');
    setDescription('');
  };

  useEffect(() => {
    let cancelled = false;

    const loadSpotifyCovers = async () => {
      const missingItems = sortedItems.filter(
        (item) => item.id && !item.thumbnailPath && item.spotifyUrl && !thumbnailMap[item.id]
      );

      if (missingItems.length === 0) return;

      const updates = await Promise.all(
        missingItems.map(async (item) => {
          try {
            const metadata = await fetchSpotifyMetadata(item.spotifyUrl || '');
            return [item.id, metadata.thumbnailUrl || ''] as const;
          } catch {
            return [item.id, ''] as const;
          }
        })
      );

      if (cancelled) return;

      setThumbnailMap((prev) => {
        const next = { ...prev };
        for (const [itemId, url] of updates) {
          if (url) next[itemId] = url;
        }
        return next;
      });
    };

    void loadSpotifyCovers();

    return () => {
      cancelled = true;
    };
  }, [sortedItems, thumbnailMap]);

  const isDoctorOwnedItem = (item: LibraryMusicItem) =>
    String(item.doctorId || '') === String(user?.id || '');

  const canEditItem = (item: LibraryMusicItem) =>
    canManage &&
    (item.isDefault || item.sourceType === 'music_seed' || isDoctorOwnedItem(item));

  const handleCreate = async () => {
    const spotifyData = extractSpotifyId(spotifyUrl);
    if (!spotifyData) {
      toast({
        title: 'Invalid Spotify URL',
        description: 'Please enter a valid Spotify track, playlist, or album URL.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const item = await libraryApi.createMusicItem({
        doctorId: user?.id || '',
        spotify_url: spotifyUrl.trim(),
        title: title.trim() || 'Relaxing Pregnancy Music',
        description: description.trim() || 'Recommended by your doctor',
      });
      onCreated?.(item);
      setCreateOpen(false);
      resetCreateForm();
      toast({
        title: 'Music added',
        description: 'The music item is now available in the library.',
      });
    } catch (error) {
      toast({
        title: 'Unable to add music',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (item: LibraryMusicItem) => {
    setEditingItem(item);
    setEditTitle(item.title || '');
    setEditDescription(item.description || '');
  };

  const handleEdit = async () => {
    if (!editingItem) return;

    setSaving(true);
    try {
      const item = await libraryApi.updateMusicItem({
        itemId: editingItem.id,
        title: editTitle.trim() || 'Relaxing Pregnancy Music',
        description: editDescription.trim() || 'Recommended by your doctor',
      });
      onUpdated?.(item);
      setEditingItem(null);
      toast({
        title: 'Music updated',
        description: 'The music details were updated successfully.',
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
      if (selectedItem?.id === itemId) setSelectedItem(null);
      toast({
        title: 'Music deleted',
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
        <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-violet-50 via-white to-sky-50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                <Music4 className="h-5 w-5 text-violet-700" />
                Music
              </CardTitle>
              <p className="text-sm text-slate-500">
                Default Spotify recommendations first, followed by doctor-added playlists and tracks.
              </p>
            </div>
            {canManage ? (
              <Button type="button" className="gap-2 rounded-full" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Music
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Loading music...
            </div>
          ) : null}

          {!loading && sortedItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No music items are available yet.
            </div>
          ) : null}

          {!loading ? (
            <div className="space-y-4">
              {sortedItems.map((item) => (
                <div key={item.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-violet-100 via-sky-50 to-white"
                      >
                        {item.thumbnailPath || thumbnailMap[item.id] ? (
                          <img
                            src={item.thumbnailPath || thumbnailMap[item.id]}
                            alt={item.title || 'Relaxing Pregnancy Music'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Music4 className="h-10 w-10 text-violet-500" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20 opacity-0 transition hover:opacity-100">
                          <PlayCircle className="h-10 w-10 text-white" />
                        </div>
                      </button>

                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">
                            {item.title || 'Relaxing Pregnancy Music'}
                          </h3>
                          {item.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                          {item.spotifyType ? (
                            <Badge variant="outline" className="capitalize">
                              {item.spotifyType}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-slate-500">
                          {item.description || 'Recommended by your doctor'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="gap-2 rounded-xl" onClick={() => setSelectedItem(item)}>
                        <PlayCircle className="h-4 w-4" />
                        Play
                      </Button>

                      {canEditItem(item) ? (
                        <Button type="button" variant="outline" className="gap-2 rounded-xl" onClick={() => openEditDialog(item)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                      ) : null}

                      {canEditItem(item) ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 rounded-xl text-destructive"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                        >
                          <Trash2 className="h-4 w-4" />
                          {deletingId === item.id ? 'Deleting...' : item.isDefault ? 'Hide' : 'Delete'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Music</DialogTitle>
            <DialogDescription>
              Paste a Spotify track, playlist, or album URL. Missing fields will use safe pregnancy-friendly defaults.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="spotify-url">Spotify URL</Label>
              <Input
                id="spotify-url"
                value={spotifyUrl}
                onChange={(e) => setSpotifyUrl(e.target.value)}
                placeholder="https://open.spotify.com/playlist/... or /album/..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="music-title">Title</Label>
              <Input
                id="music-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="music-description">Description</Label>
              <Textarea
                id="music-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                resetCreateForm();
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} disabled={saving}>
              {saving ? 'Saving...' : 'Save Music'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Music</DialogTitle>
            <DialogDescription>
              Update the title and description for this music item. Changes to default music apply only to your patient pipeline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-music-title">Title</Label>
              <Input
                id="edit-music-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-music-description">Description</Label>
              <Textarea
                id="edit-music-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
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

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-4xl rounded-3xl border-0 bg-white">
          {selectedItem ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedItem.title || 'Relaxing Pregnancy Music'}</DialogTitle>
                <DialogDescription>
                  {selectedItem.description || 'Recommended by your doctor'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl">
                  <iframe
                    title={selectedItem.title || 'Relaxing Pregnancy Music'}
                    src={getSpotifyEmbedUrl(
                      selectedItem.spotifyId || extractSpotifyId(selectedItem.spotifyUrl || '')?.id,
                      selectedItem.spotifyType || extractSpotifyId(selectedItem.spotifyUrl || '')?.type
                    )}
                    className="h-[352px] w-full rounded-2xl"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                  />
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

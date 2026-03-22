import { CalendarDays, NotebookPen, PlayCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LibraryMediaItem } from '@/types/library';
import { formatDateTime } from '@/components/library/libraryDisplay';

interface DiaryMediaSectionProps {
  items: LibraryMediaItem[];
  loading?: boolean;
  onOpenItem: (item: LibraryMediaItem) => void;
}

export function DiaryMediaSection({ items, loading = false, onOpenItem }: DiaryMediaSectionProps) {
  return (
    <Card className="border-0 bg-white/80 shadow-sm backdrop-blur">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-teal-50 via-white to-cyan-50">
        <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
          <NotebookPen className="h-5 w-5 text-teal-700" />
          Diary Media
        </CardTitle>
        <p className="text-sm text-slate-500">
          Diary-origin photos and videos stay separate from normal memories while remaining linked to diary entries.
        </p>
      </CardHeader>
      <CardContent className="p-6">
        {loading ? (
          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Loading diary media...
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-teal-50/50 p-8 text-center text-sm text-slate-500">
            Diary-linked media will appear here when diary entries include photos or videos.
          </div>
        ) : null}

        {!loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenItem(item)}
                className="overflow-hidden rounded-3xl border border-slate-100 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative h-48 bg-slate-100">
                  {item.mediaType === 'video' ? (
                    <>
                      <video src={item.streamUrl} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20">
                        <PlayCircle className="h-12 w-12 text-white" />
                      </div>
                    </>
                  ) : (
                    <img src={item.previewUrl} alt={item.title || 'Diary media'} className="h-full w-full object-cover" />
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Diary Origin</Badge>
                    <Badge variant="outline">{item.mediaType === 'video' ? 'Diary Video' : 'Diary Photo'}</Badge>
                  </div>

                  <div className="line-clamp-1 font-medium text-slate-900">
                    {item.title || (item.mediaType === 'video' ? 'Diary video entry' : 'Diary photo entry')}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>{formatDateTime(item.capturedAt || item.uploadedAt)}</span>
                  </div>

                  <div className="text-xs text-slate-500">
                    {item.diaryEntryId ? `Linked entry: ${item.diaryEntryId}` : 'Diary entry context available through the Library record.'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

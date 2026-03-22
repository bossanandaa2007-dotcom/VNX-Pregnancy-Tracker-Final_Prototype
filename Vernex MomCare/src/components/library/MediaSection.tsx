import { Camera, Clock3, Film, FolderTree, LockKeyhole, PlayCircle, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { LibraryMediaItem } from '@/types/library';
import {
  formatDateTime,
  getMediaDateLabel,
  getSourceLabel,
  groupItemsBySourceAndDate,
  mediaLabels,
} from '@/components/library/libraryDisplay';

interface MediaSectionProps {
  title: string;
  description: string;
  items: LibraryMediaItem[];
  loading?: boolean;
  onOpenItem: (item: LibraryMediaItem) => void;
  onUploadClick?: () => void;
}

const sourceIcons = {
  camera_photo: Camera,
  camera_video: Film,
  upload_photo: Upload,
  upload_video: Upload,
  google_photos: Upload,
  google_drive: Upload,
};

export function MediaSection({
  title,
  description,
  items,
  loading = false,
  onOpenItem,
  onUploadClick,
}: MediaSectionProps) {
  const groups = groupItemsBySourceAndDate(items);

  return (
    <Card className="overflow-hidden border-0 bg-white/80 shadow-sm backdrop-blur">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-rose-50 via-white to-amber-50">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-xl text-slate-900">{title}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          {onUploadClick ? (
            <Button type="button" onClick={onUploadClick} className="rounded-full">
              Add Media
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <LockKeyhole className="h-4 w-4 text-emerald-600" />
          Private media is grouped by source and date folder, with server-side filenames and encrypted-ready metadata.
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Loading memories...
          </div>
        ) : null}

        {!loading && groups.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No memories match the current filters.
          </div>
        ) : null}

        {!loading ? (
          <div className="space-y-8">
            {groups.map(({ sourceType, items: sourceItems, dateGroups }) => {
              const SourceIcon = sourceIcons[sourceType as keyof typeof sourceIcons] || Upload;

              return (
                <div key={sourceType} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-slate-100 p-2 text-slate-700">
                      <SourceIcon className="h-4 w-4" />
                    </div>
                    <div className="font-semibold text-slate-900">{getSourceLabel(sourceType)}</div>
                    <Badge variant="secondary">{sourceItems.length}</Badge>
                  </div>

                  <div className="space-y-5">
                    {dateGroups.map(([dateKey, dateItems]) => (
                      <div key={`${sourceType}-${dateKey}`} className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <FolderTree className="h-4 w-4 text-amber-600" />
                          <span>{dateKey}</span>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {dateItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onOpenItem(item)}
                              className="overflow-hidden rounded-3xl border border-slate-100 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                              <div className="relative h-52 bg-slate-100">
                                {item.mediaType === 'video' ? (
                                  <>
                                    <video src={item.streamUrl} className="h-full w-full object-cover" />
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20">
                                      <PlayCircle className="h-12 w-12 text-white" />
                                    </div>
                                  </>
                                ) : (
                                  <img
                                    src={item.previewUrl}
                                    alt={item.title || item.sourceType}
                                    className="h-full w-full object-cover"
                                  />
                                )}
                              </div>

                              <div className="space-y-3 p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">{mediaLabels[item.mediaType]}</Badge>
                                  <Badge variant="secondary">{getSourceLabel(item.sourceType)}</Badge>
                                </div>

                                <div className="line-clamp-1 font-medium text-slate-900">
                                  {item.title || `${mediaLabels[item.mediaType]} from ${getSourceLabel(item.sourceType)}`}
                                </div>

                                <div className="grid gap-2 text-xs text-slate-500">
                                  <div className="flex items-center gap-2">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    <span>Uploaded: {formatDateTime(item.uploadedAt)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    <span>Captured: {formatDateTime(item.capturedAt)}</span>
                                  </div>
                                  <div>
                                    Folder group: {getMediaDateLabel(item)} {item.folderTime ? `at ${item.folderTime}` : ''}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

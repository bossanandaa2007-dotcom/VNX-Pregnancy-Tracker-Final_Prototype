import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { LibraryItem } from '@/types/library';
import { formatDateTime, getSourceLabel, mediaLabels } from '@/components/library/libraryDisplay';

interface MediaViewerDialogProps {
  item: LibraryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MediaViewerDialog({ item, open, onOpenChange }: MediaViewerDialogProps) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-3xl border-0 bg-slate-950 text-white">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-white/10 text-white">
              {item.bucket === 'diary' ? 'Diary Media' : 'Memory'}
            </Badge>
            <Badge variant="outline" className="border-white/20 text-white">
              {mediaLabels[item.mediaType]}
            </Badge>
            <Badge variant="outline" className="border-white/20 text-white">
              {getSourceLabel(item.sourceType)}
            </Badge>
            {item.sourceAuthority ? (
              <Badge variant="outline" className="border-white/20 text-white">
                {item.sourceAuthority}
              </Badge>
            ) : null}
          </div>
          <DialogTitle className="text-xl">
            {item.title || `${mediaLabels[item.mediaType]} preview`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
            {item.mediaType === 'video' ? (
              <video src={item.streamUrl} controls className="max-h-[70vh] w-full" />
            ) : (
              <img src={item.previewUrl} alt={item.title || 'Library preview'} className="max-h-[70vh] w-full object-contain" />
            )}
          </div>

          <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
            <div>Captured: {formatDateTime(item.capturedAt)}</div>
            <div>Uploaded: {formatDateTime(item.uploadedAt)}</div>
            <div>Encrypted: {item.isEncrypted ? 'Yes' : 'Encryption-ready metadata only'}</div>
            <div>Checksum: {item.checksum || 'Pending / not available'}</div>
          </div>

          {item.tags?.length ? (
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="bg-white/10 text-white">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

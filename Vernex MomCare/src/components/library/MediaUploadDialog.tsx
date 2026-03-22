import { useRef, useState } from 'react';
import { Camera, Film, ImagePlus, UploadCloud, Video } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { libraryApi } from '@/lib/libraryApi';
import type { LibraryMediaItem, LibrarySection, LibrarySourceType } from '@/types/library';

interface MediaUploadDialogProps {
  patientId: string;
  section: LibrarySection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: (item: LibraryMediaItem) => void;
}

export function MediaUploadDialog({
  patientId,
  section,
  open,
  onOpenChange,
  onUploaded,
}: MediaUploadDialogProps) {
  const cameraPhotoInputRef = useRef<HTMLInputElement>(null);
  const uploadPhotoInputRef = useRef<HTMLInputElement>(null);
  const uploadVideoInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (file: File, sourceType: LibrarySourceType) => {
    setUploading(true);
    try {
      const item = await libraryApi.uploadMemory({
        patientId,
        sourceType,
        file,
        capturedAt: new Date().toISOString(),
      });
      onUploaded(item);
      onOpenChange(false);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-0 bg-white p-0 sm:max-w-2xl">
        <DialogHeader className="rounded-t-3xl bg-gradient-to-r from-rose-100 via-amber-50 to-teal-100 p-6">
          <DialogTitle className="text-xl text-slate-900">
            {section === 'diary' ? 'Add Diary Media' : 'Add to Memories'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 p-6 md:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-28 flex-col gap-3 rounded-3xl border-slate-200"
            onClick={() => cameraPhotoInputRef.current?.click()}
            disabled={uploading}
          >
            <div className="rounded-full bg-rose-100 p-3 text-rose-700">
              <Camera className="h-5 w-5" />
            </div>
            <div className="text-center">
              <div className="font-semibold">Camera Photo</div>
              <div className="text-xs text-slate-500">Use browser camera capture for a photo memory</div>
            </div>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-28 flex-col gap-3 rounded-3xl border-slate-200"
            onClick={() => cameraVideoInputRef.current?.click()}
            disabled={uploading}
          >
            <div className="rounded-full bg-sky-100 p-3 text-sky-700">
              <Video className="h-5 w-5" />
            </div>
            <div className="text-center">
              <div className="font-semibold">Camera Video</div>
              <div className="text-xs text-slate-500">Direct browser capture where supported by the device</div>
            </div>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-28 flex-col gap-3 rounded-3xl border-slate-200"
            onClick={() => uploadPhotoInputRef.current?.click()}
            disabled={uploading}
          >
            <div className="rounded-full bg-amber-100 p-3 text-amber-700">
              <ImagePlus className="h-5 w-5" />
            </div>
            <div className="text-center">
              <div className="font-semibold">Upload Photo</div>
              <div className="text-xs text-slate-500">Add a stored photo and keep its source label visible</div>
            </div>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-28 flex-col gap-3 rounded-3xl border-slate-200"
            onClick={() => uploadVideoInputRef.current?.click()}
            disabled={uploading}
          >
            <div className="rounded-full bg-indigo-100 p-3 text-indigo-700">
              <Film className="h-5 w-5" />
            </div>
            <div className="text-center">
              <div className="font-semibold">Upload Video</div>
              <div className="text-xs text-slate-500">Upload a video that plays inside the app</div>
            </div>
          </Button>

          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 md:col-span-2">
            <div className="flex items-center gap-3 text-slate-700">
              <UploadCloud className="h-5 w-5" />
              <div className="font-semibold">{uploading ? 'Uploading secure media...' : 'Secure handling enabled'}</div>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Uploads are sent to the Library backend with safe filenames, source labels, and patient/date folder metadata.
            </p>
          </div>
        </div>

        <input
          ref={cameraPhotoInputRef}
          hidden
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file, 'camera_photo');
            e.target.value = '';
          }}
        />
        <input
          ref={cameraVideoInputRef}
          hidden
          type="file"
          accept="video/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file, 'camera_video');
            e.target.value = '';
          }}
        />
        <input
          ref={uploadPhotoInputRef}
          hidden
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file, 'upload_photo');
            e.target.value = '';
          }}
        />
        <input
          ref={uploadVideoInputRef}
          hidden
          type="file"
          accept="video/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file, 'upload_video');
            e.target.value = '';
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

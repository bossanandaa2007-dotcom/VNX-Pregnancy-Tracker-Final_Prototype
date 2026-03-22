import { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as DiaryCalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Edit, Image, Smile, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { addDays, format, parseISO, subDays } from 'date-fns';
import { API_BASE } from '@/config/api';
import { libraryApi } from '@/lib/libraryApi';
import type { LibraryMediaItem } from '@/types/library';

type Mood = 'happy' | 'calm' | 'tired' | 'sad';

interface DiaryEntry {
  _id?: string;
  date: string;
  text: string;
  mood?: Mood;
  images?: string[];
  imageData?: string;
  mediaRefs?: string[];
  mediaItems?: LibraryMediaItem[];
}

const getMonthKey = (value: Date) => format(value, 'yyyy-MM');
const parseDateValue = (value: string) => parseISO(`${value}T00:00:00`);

const normalizeLegacyImages = (entry: DiaryEntry | null) => {
  if (!entry) return [];
  if (Array.isArray(entry.images) && entry.images.length > 0) {
    return entry.images.filter(Boolean);
  }
  return entry.imageData ? [entry.imageData] : [];
};

export default function Diary() {
  const { user } = useAuth();
  const { toast } = useToast();

  const getLocalDateString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 10);
  };

  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [text, setText] = useState('');
  const [mood, setMood] = useState<Mood | undefined>();
  const [mediaItems, setMediaItems] = useState<LibraryMediaItem[]>([]);
  const [legacyImages, setLegacyImages] = useState<string[]>([]);
  const [highlightedDates, setHighlightedDates] = useState<string[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => parseDateValue(getLocalDateString()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const existingEntry = entry;
  const highlightedDayObjects = useMemo(
    () => highlightedDates.map((value) => parseDateValue(value)),
    [highlightedDates]
  );

  const fetchEntry = async (date: string) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/diary?patientId=${user.id}&date=${date}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || 'Failed to fetch diary entry');
      }
      const data = await res.json();
      const nextEntry = data.entry as DiaryEntry | null;
      setEntry(nextEntry);
      setText(nextEntry?.text || '');
      setMood(nextEntry?.mood);
      setMediaItems(Array.isArray(nextEntry?.mediaItems) ? nextEntry!.mediaItems! : []);
      setLegacyImages(normalizeLegacyImages(nextEntry));
      setIsEditing(!nextEntry);
    } catch (err) {
      console.error('Diary fetch error:', err);
      toast({
        title: 'Error',
        description: 'Unable to load diary entry for selected date',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchHighlightedDates = async (month: Date) => {
    if (!user?.id) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/diary/dates?patientId=${user.id}&month=${getMonthKey(month)}`
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || 'Failed to fetch diary dates');
      }
      const data = await res.json();
      setHighlightedDates(Array.isArray(data?.dates) ? data.dates : []);
    } catch (err) {
      console.error('Diary dates fetch error:', err);
      toast({
        title: 'Error',
        description: 'Unable to load diary dates for the calendar',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (user?.id) {
      void fetchEntry(selectedDate);
    }
  }, [selectedDate, user?.id]);

  useEffect(() => {
    if (user?.id) {
      void fetchHighlightedDates(calendarMonth);
    }
  }, [calendarMonth, user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    if (uploadingMedia) {
      toast({
        title: 'Media still uploading',
        description: 'Wait for the selected photos to finish uploading before saving.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/diary/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: user.id,
          date: selectedDate,
          text,
          mood,
          mediaRefs: mediaItems.map((item) => item.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      const savedEntry = data.entry as DiaryEntry;
      setEntry(savedEntry);
      setText(savedEntry.text || '');
      setMood(savedEntry.mood);
      setMediaItems(savedEntry.mediaItems || []);
      setLegacyImages(normalizeLegacyImages(savedEntry));
      setIsEditing(false);
      setHighlightedDates((prev) =>
        prev.includes(selectedDate) ? prev : [...prev, selectedDate].sort()
      );
      toast({
        title: 'Saved',
        description: `Diary updated for ${selectedDate}`,
      });
    } catch (err) {
      console.error('Diary save error:', err);
      toast({
        title: 'Save failed',
        description: 'Unable to save diary entry',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const isMobile = () =>
    /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent || '');

  const uploadDiaryMedia = async (file: File, sourceType: 'camera_photo' | 'upload') => {
    if (!user?.id) return;
    setUploadingMedia(true);
    try {
      const item = await libraryApi.uploadMedia({
        patientId: user.id,
        section: 'diary',
        sourceType,
        file,
        capturedAt: new Date().toISOString(),
      });
      setMediaItems((prev) => [item, ...prev]);
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Could not upload image',
        variant: 'destructive',
      });
    } finally {
      setUploadingMedia(false);
    }
  };

  const changeSelectedDate = (nextDate: string) => {
    setSelectedDate(nextDate);
    setCalendarMonth(parseDateValue(nextDate));
  };

  const goToPreviousDay = () => {
    changeSelectedDate(format(subDays(parseDateValue(selectedDate), 1), 'yyyy-MM-dd'));
  };

  const goToNextDay = () => {
    changeSelectedDate(format(addDays(parseDateValue(selectedDate), 1), 'yyyy-MM-dd'));
  };

  const removeMedia = (indexToRemove: number) => {
    setMediaItems((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const renderMediaGrid = () => {
    if (mediaItems.length > 0) {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {mediaItems.map((item, index) => (
            <div key={item.id} className="relative overflow-hidden rounded-xl border bg-accent/20">
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => removeMedia(index)}
                  className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
                  aria-label={`Remove image ${index + 1}`}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
              <img
                src={item.previewUrl}
                alt={`Diary memory ${index + 1}`}
                className="h-48 w-full object-cover"
              />
            </div>
          ))}
        </div>
      );
    }

    if (legacyImages.length > 0) {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {legacyImages.map((image, index) => (
            <img
              key={`${selectedDate}-legacy-${index}`}
              src={image}
              alt={`Diary memory ${index + 1}`}
              className="rounded-xl max-h-64 w-full object-cover"
            />
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-6 overflow-x-hidden">
        <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-accent/40">
          <div className="p-5 sm:p-6">
            <h1 className="text-2xl font-bold">My Pregnancy Diary</h1>
            <p className="text-muted-foreground">
              A safe space to write, reflect, and save diary-linked media in the secure Library
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 overflow-hidden pt-6 sm:flex-row sm:items-center">
            <Calendar className="h-5 w-5 text-primary" />
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="button" variant="outline" size="icon" className="shrink-0 rounded-xl" onClick={goToPreviousDay} aria-label="Go to previous day">
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full min-w-0 justify-between font-normal sm:w-[220px]">
                    <span>{format(parseDateValue(selectedDate), 'dd-MM-yyyy')}</span>
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <DiaryCalendar
                    mode="single"
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    selected={parseDateValue(selectedDate)}
                    onSelect={(date) => {
                      if (!date) return;
                      const nextDate = format(date, 'yyyy-MM-dd');
                      changeSelectedDate(nextDate);
                      setCalendarOpen(false);
                    }}
                    modifiers={{ written: highlightedDayObjects }}
                    modifiersClassNames={{
                      written: 'bg-primary/15 text-primary font-semibold rounded-md',
                    }}
                  />
                </PopoverContent>
              </Popover>

              <Button type="button" variant="outline" size="icon" className="shrink-0 rounded-xl" onClick={goToNextDay} aria-label="Go to next day">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {existingEntry && (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary" />
                Your Story for {selectedDate}
              </CardTitle>
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setIsEditing((prev) => !prev)}>
                {isEditing ? 'Cancel' : 'Edit Entry'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {(['happy', 'calm', 'tired', 'sad'] as Mood[]).map((m) => (
                      <Button
                        key={m}
                        variant={mood === m ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setMood(m)}
                        className="min-w-[calc(50%-0.25rem)] flex-1 capitalize sm:min-w-0 sm:flex-none"
                      >
                        <Smile className="mr-1 h-4 w-4" />
                        {m}
                      </Button>
                    ))}
                  </div>

                  <Textarea
                    placeholder="Write anything you feel like today..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={6}
                  />

                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          if (isMobile()) {
                            cameraInputRef.current?.click();
                          } else {
                            uploadInputRef.current?.click();
                          }
                        }}
                      >
                        <Image className="h-4 w-4" />
                        Take Photo
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => uploadInputRef.current?.click()}>
                        <Image className="h-4 w-4" />
                        Upload Photo
                      </Button>
                    </div>

                    {uploadingMedia ? (
                      <p className="text-sm text-muted-foreground">Uploading diary media...</p>
                    ) : null}

                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void uploadDiaryMedia(file, 'camera_photo');
                        }
                        e.target.value = '';
                      }}
                    />
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void uploadDiaryMedia(file, 'upload');
                        }
                        e.target.value = '';
                      }}
                    />

                    {renderMediaGrid()}
                  </div>

                  <Button onClick={handleSave} className="w-full" disabled={saving || loading || uploadingMedia}>
                    {saving ? 'Saving...' : uploadingMedia ? 'Uploading media...' : `Update Story for ${selectedDate}`}
                  </Button>
                </>
              ) : (
                <>
                  {existingEntry.mood ? (
                    <p className="text-sm">
                      Mood: <span className="capitalize">{existingEntry.mood}</span>
                    </p>
                  ) : null}
                  <p className="whitespace-pre-line text-muted-foreground">{existingEntry.text}</p>
                  {renderMediaGrid()}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {!existingEntry && (
          <Card>
            <CardHeader>
              <CardTitle>How was your day, mom?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(['happy', 'calm', 'tired', 'sad'] as Mood[]).map((m) => (
                  <Button
                    key={m}
                    variant={mood === m ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMood(m)}
                    className="min-w-[calc(50%-0.25rem)] flex-1 capitalize sm:min-w-0 sm:flex-none"
                  >
                    <Smile className="mr-1 h-4 w-4" />
                    {m}
                  </Button>
                ))}
              </div>

              <Textarea
                placeholder="Write anything you feel like today..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
              />

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      if (isMobile()) {
                        cameraInputRef.current?.click();
                      } else {
                        uploadInputRef.current?.click();
                      }
                    }}
                  >
                    <Image className="h-4 w-4" />
                    Take Photo
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => uploadInputRef.current?.click()}>
                    <Image className="h-4 w-4" />
                    Upload Photo
                  </Button>
                </div>

                {uploadingMedia ? (
                  <p className="text-sm text-muted-foreground">Uploading diary media...</p>
                ) : null}

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void uploadDiaryMedia(file, 'camera_photo');
                    }
                    e.target.value = '';
                  }}
                />
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void uploadDiaryMedia(file, 'upload');
                    }
                    e.target.value = '';
                  }}
                />

                {renderMediaGrid()}
              </div>

              <Button onClick={handleSave} className="w-full" disabled={saving || loading || uploadingMedia}>
                {saving ? 'Saving...' : uploadingMedia ? 'Uploading media...' : `Save Story for ${selectedDate}`}
              </Button>
            </CardContent>
          </Card>
        )}

        {!existingEntry && !text && mediaItems.length === 0 && legacyImages.length === 0 && !loading ? (
          <p className="text-center text-sm text-muted-foreground">
            You haven&apos;t written anything for this day yet
          </p>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { libraryApi } from '@/lib/libraryApi';
import { LibraryShell } from '@/components/library/LibraryShell';
import { MediaSection } from '@/components/library/MediaSection';
import { DiaryMediaSection } from '@/components/library/DiaryMediaSection';
import { FitnessSection } from '@/components/library/FitnessSection';
import { MusicSection } from '@/components/library/MusicSection';
import { MediaUploadDialog } from '@/components/library/MediaUploadDialog';
import { MediaViewerDialog } from '@/components/library/MediaViewerDialog';
import { AdminPatientPicker } from '@/components/library/AdminPatientPicker';
import { Card, CardContent } from '@/components/ui/card';
import type {
  LibraryFitnessItem,
  LibraryItem,
  LibraryMusicItem,
  LibraryPatientOption,
} from '@/types/library';
import { getItemSearchText } from '@/components/library/libraryDisplay';

export default function Library() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPatient, setSelectedPatient] = useState<LibraryPatientOption | null>(null);
  const [memories, setMemories] = useState<LibraryItem[]>([]);
  const [diaryMedia, setDiaryMedia] = useState<LibraryItem[]>([]);
  const [fitness, setFitness] = useState<LibraryFitnessItem[]>([]);
  const [music, setMusic] = useState<LibraryMusicItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [memoriesDialogOpen, setMemoriesDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModule, setActiveModule] = useState<'memories' | 'diary' | 'fitness' | 'music'>(
    user?.role === 'doctor' ? 'fitness' : 'memories'
  );

  const effectivePatientId = user?.role === 'admin' ? selectedPatient?._id || '' : user?.id || '';
  const canManageMedia = user?.role === 'doctor';
  const isDoctor = user?.role === 'doctor';
  const isPatient = user?.role === 'patient';

  const title =
    user?.role === 'admin'
      ? selectedPatient
        ? `${selectedPatient.name}'s Library`
        : 'Patient Library'
      : 'My Secure Library';

  const subtitle =
    user?.role === 'admin'
      ? selectedPatient
        ? 'Review memories, diary media, pregnancy-safe fitness videos, and soothing music in one secure place.'
        : 'Select a patient to open their secure library.'
      : isDoctor
      ? 'A clean dashboard for pregnancy-safe fitness videos and soothing music.'
      : 'A clean dashboard for memories, diary media, pregnancy-safe fitness videos, and soothing music.';

  useEffect(() => {
    setActiveModule(user?.role === 'doctor' ? 'fitness' : 'memories');
  }, [user?.role]);

  useEffect(() => {
    let active = true;

    const loadLibrary = async () => {
      if (!effectivePatientId) {
        if (active) {
          setMemories([]);
          setDiaryMedia([]);
          setFitness([]);
          setMusic([]);
        }
        return;
      }

      setLoading(true);
      try {
        const [memoryItems, diaryItems, fitnessItems, musicItems] = await Promise.all([
          isPatient ? libraryApi.getPatientMemories(effectivePatientId) : Promise.resolve([]),
          isPatient ? libraryApi.getPatientDiaryMedia(effectivePatientId) : Promise.resolve([]),
          isPatient ? libraryApi.getPatientFitness(effectivePatientId) : libraryApi.getFitness(),
          isPatient ? libraryApi.getPatientMusic(effectivePatientId) : libraryApi.getMusic(),
        ]);

        if (!active) return;
        setMemories(memoryItems);
        setDiaryMedia(diaryItems);
        setFitness(fitnessItems);
        setMusic(musicItems);
      } catch (error) {
        if (!active) return;
        toast({
          title: 'Library unavailable',
          description: error instanceof Error ? error.message : 'Unable to load library sections',
          variant: 'destructive',
        });
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadLibrary();

    return () => {
      active = false;
    };
  }, [effectivePatientId, isPatient, toast]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredMemories = useMemo(
    () =>
      normalizedQuery
        ? memories.filter((item) => getItemSearchText(item).includes(normalizedQuery))
        : memories,
    [memories, normalizedQuery]
  );
  const filteredDiaryMedia = useMemo(
    () =>
      normalizedQuery
        ? diaryMedia.filter((item) => getItemSearchText(item).includes(normalizedQuery))
        : diaryMedia,
    [diaryMedia, normalizedQuery]
  );

  const handleUploadedMemory = (item: LibraryItem) => {
    setMemories((prev) => [item, ...prev]);
    toast({
      title: 'Memory added',
      description: 'The media item is now stored in the secure Library.',
    });
  };

  return (
    <DashboardLayout>
      <LibraryShell
        title={title}
        subtitle={subtitle}
        role={isDoctor ? 'doctor' : 'patient'}
        activeModule={activeModule}
        onModuleChange={setActiveModule}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      >
        {user?.role === 'admin' ? (
          <AdminPatientPicker
            selectedPatientId={selectedPatient?._id || ''}
            onSelectPatient={(patient) => setSelectedPatient(patient)}
          />
        ) : null}

        {!effectivePatientId ? (
          <Card className="border-0 bg-white/80 shadow-sm">
            <CardContent className="p-8 text-center text-sm text-slate-500">
              Select a patient to view secure Library content.
            </CardContent>
          </Card>
        ) : (
          <>
            {activeModule === 'fitness' ? (
              <FitnessSection
                items={fitness}
                loading={loading}
                canManage={canManageMedia}
                onCreated={(item) => setFitness((prev) => [item, ...prev])}
                onUpdated={(item) =>
                  setFitness((prev) => prev.map((row) => (row.id === item.id ? item : row)))
                }
                onDeleted={(itemId) =>
                  setFitness((prev) => prev.filter((item) => item.id !== itemId))
                }
              />
            ) : null}
            {isPatient && activeModule === 'memories' ? (
              <div className="space-y-4">
                <MediaSection
                  title="Memories"
                  description="Camera photos, camera videos, uploaded photos, and uploaded videos grouped cleanly by source and date."
                  items={filteredMemories}
                  loading={loading}
                  onOpenItem={setSelectedItem}
                  onUploadClick={() => setMemoriesDialogOpen(true)}
                />
              </div>
            ) : null}
            {isPatient && activeModule === 'diary' ? (
              <DiaryMediaSection
                items={filteredDiaryMedia}
                loading={loading}
                onOpenItem={setSelectedItem}
              />
            ) : null}
            {activeModule === 'music' ? (
              <MusicSection
                items={music}
                loading={loading}
                canManage={canManageMedia}
                onCreated={(item) => setMusic((prev) => [item, ...prev])}
                onUpdated={(item) =>
                  setMusic((prev) => prev.map((row) => (row.id === item.id ? item : row)))
                }
                onDeleted={(itemId) =>
                  setMusic((prev) => prev.filter((item) => item.id !== itemId))
                }
              />
            ) : null}
          </>
        )}
      </LibraryShell>

      {isPatient ? (
        <>
          <MediaUploadDialog
            patientId={effectivePatientId}
            section="memories"
            open={memoriesDialogOpen}
            onOpenChange={setMemoriesDialogOpen}
            onUploaded={handleUploadedMemory}
          />

          <MediaViewerDialog
            item={selectedItem}
            open={!!selectedItem}
            onOpenChange={(open) => {
              if (!open) setSelectedItem(null);
            }}
          />
        </>
      ) : null}
    </DashboardLayout>
  );
}

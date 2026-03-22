export type LibraryBucket = 'memories' | 'diary' | 'fitness' | 'music';
export type LibrarySection = 'memories' | 'diary';
export type LibraryMediaType = 'image' | 'video' | 'youtube' | 'spotify' | 'external';
export type LibraryTrimester = 'first' | 'second' | 'third' | 'all' | '';
export type LibrarySourceType =
  | 'upload_photo'
  | 'upload_video'
  | 'camera_photo'
  | 'camera_video'
  | 'diary_photo'
  | 'diary_video'
  | 'google_photos'
  | 'google_drive'
  | 'fitness_seed'
  | 'doctor_fitness_override'
  | 'doctor_fitness_hidden'
  | 'music_seed'
  | 'doctor_fitness'
  | 'doctor_music'
  | 'doctor_music_override'
  | 'doctor_music_hidden'
  | 'upload';

export interface LibraryEncryptionMeta {
  status?: 'not_enabled' | 'pending' | 'encrypted';
  keyRef?: string;
  provider?: string;
}

export interface LibraryItem {
  id: string;
  patientId: string | null;
  uploadedBy: string | null;
  bucket: LibraryBucket;
  sourceType: LibrarySourceType;
  mediaType: LibraryMediaType;
  title: string;
  description: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  thumbnailPath: string;
  capturedAt?: string | null;
  uploadedAt?: string | null;
  folderYear?: string;
  folderMonth?: string;
  folderDay?: string;
  folderTime?: string;
  diaryEntryId?: string | null;
  pregnancyWeek?: number | null;
  pregnancyMonth?: number | null;
  trimester?: LibraryTrimester;
  doctorId?: string;
  category?: string;
  isDefault?: boolean;
  youtubeVideoId?: string;
  defaultYouTubeVideoId?: string;
  youtubeUrl?: string;
  spotifyId?: string;
  defaultSpotifyId?: string;
  spotifyType?: '' | 'track' | 'playlist' | 'album';
  spotifyUrl?: string;
  embedUrl?: string;
  sourceAuthority?: string;
  tags?: string[];
  isEncrypted?: boolean;
  encryptionMeta?: LibraryEncryptionMeta;
  adminVisibility?: 'patient_admin' | 'admin_only';
  isSyncedFromGoogle?: boolean;
  googleSourceType?: '' | 'google_photos' | 'google_drive';
  googleSourceId?: string;
  checksum?: string;
  status: 'active' | 'deleted';
  createdAt?: string;
  updatedAt?: string;
  streamUrl?: string;
  previewUrl?: string;
}

export interface LibrarySummaryResponse {
  counts: {
    memories: number;
    diaryMedia: number;
    fitness: number;
    music: number;
  };
  memories: LibraryItem[];
  diaryMedia: LibraryItem[];
  fitness: LibraryItem[];
  music: LibraryItem[];
}

export interface LibraryOverview {
  counts: {
    memories: number;
    diaryMedia: number;
  };
  latestMemories: LibraryItem[];
  latestDiaryMedia: LibraryItem[];
}

export type LibraryMediaItem = LibraryItem;
export type LibraryFitnessItem = LibraryItem;
export type LibraryMusicItem = LibraryItem;
export type LibraryFitnessVideo = LibraryItem;

export interface LibraryPatientOption {
  _id: string;
  name: string;
  email: string;
  gestationalWeek?: number;
  profilePhoto?: string;
}

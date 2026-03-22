import { API_BASE } from '@/config/api';
import type {
  LibraryBucket,
  LibraryFitnessItem,
  LibraryItem,
  LibraryMediaItem,
  LibraryMusicItem,
  LibraryOverview,
  LibraryPatientOption,
  LibrarySection,
  LibrarySourceType,
  LibrarySummaryResponse,
} from '@/types/library';

class ApiRouteNotFoundError extends Error {
  status: number;

  constructor(message: string, status = 404) {
    super(message);
    this.name = 'ApiRouteNotFoundError';
    this.status = status;
  }
}

const handleJson = async <T>(res: Response): Promise<T> => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string })?.error || 'Request failed';
    if (res.status === 404) {
      throw new ApiRouteNotFoundError(message, res.status);
    }
    throw new Error(message);
  }
  return data as T;
};

const getLibraryAuthHeaders = () => {
  try {
    const raw = localStorage.getItem('vnx_user');
    const user = raw ? JSON.parse(raw) : null;
    if (!user?.id || !user?.role) return {};
    return {
      'x-user-id': String(user.id),
      'x-user-role': String(user.role),
    };
  } catch {
    return {};
  }
};

const getLibraryActor = () => {
  try {
    const raw = localStorage.getItem('vnx_user');
    const user = raw ? JSON.parse(raw) : null;
    if (!user?.id || !user?.role) return null;
    return { id: String(user.id), role: String(user.role) };
  } catch {
    return null;
  }
};

const withLibraryActorQuery = (value: string) => {
  if (!value) return '';
  const actor = getLibraryActor();
  if (!actor) return value;

  try {
    const url = new URL(value);
    if (url.origin !== new URL(API_BASE).origin) return value;
    url.searchParams.set('libraryUserId', actor.id);
    url.searchParams.set('libraryUserRole', actor.role);
    return url.toString();
  } catch {
    return value;
  }
};

const libraryFetch = (input: RequestInfo | URL, init: RequestInit = {}) =>
  fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...getLibraryAuthHeaders(),
    },
  });

const normalizeItem = (item: Partial<LibraryItem>): LibraryItem => ({
  id: String(item.id || ''),
  patientId: item.patientId ?? null,
  uploadedBy: item.uploadedBy ?? null,
  bucket: (item.bucket || 'memories') as LibraryBucket,
  sourceType: (item.sourceType || 'upload_photo') as LibrarySourceType,
  mediaType: (item.mediaType || 'image') as LibraryItem['mediaType'],
  title: item.title || '',
  description: item.description || '',
  mimeType: item.mimeType || '',
  sizeBytes: Number(item.sizeBytes || 0),
  storagePath: item.storagePath || '',
  thumbnailPath: item.thumbnailPath || '',
  capturedAt: item.capturedAt || null,
  uploadedAt: item.uploadedAt || null,
  folderYear: item.folderYear || '',
  folderMonth: item.folderMonth || '',
  folderDay: item.folderDay || '',
  folderTime: item.folderTime || '',
  diaryEntryId: item.diaryEntryId || null,
  pregnancyWeek: item.pregnancyWeek ?? null,
  pregnancyMonth: item.pregnancyMonth ?? null,
  trimester: item.trimester || '',
  doctorId: item.doctorId || '',
  category: item.category || '',
  isDefault: Boolean(item.isDefault),
  youtubeVideoId: item.youtubeVideoId || '',
  defaultYouTubeVideoId: item.defaultYouTubeVideoId || '',
  youtubeUrl: item.youtubeUrl || '',
  spotifyId: item.spotifyId || '',
  defaultSpotifyId: item.defaultSpotifyId || '',
  spotifyType: item.spotifyType || '',
  spotifyUrl: item.spotifyUrl || '',
  embedUrl: item.embedUrl || '',
  sourceAuthority: item.sourceAuthority || '',
  tags: Array.isArray(item.tags) ? item.tags : [],
  isEncrypted: Boolean(item.isEncrypted),
  encryptionMeta: item.encryptionMeta || { status: 'not_enabled', keyRef: '', provider: '' },
  adminVisibility: item.adminVisibility || 'patient_admin',
  isSyncedFromGoogle: Boolean(item.isSyncedFromGoogle),
  googleSourceType: item.googleSourceType || '',
  googleSourceId: item.googleSourceId || '',
  checksum: item.checksum || '',
  status: item.status || 'active',
  createdAt: item.createdAt || '',
  updatedAt: item.updatedAt || '',
  streamUrl: withLibraryActorQuery(item.streamUrl || ''),
  previewUrl: withLibraryActorQuery(item.previewUrl || item.streamUrl || item.thumbnailPath || item.embedUrl || ''),
});

const normalizeSourceType = (sourceType: LibrarySourceType, file: File) => {
  if (sourceType === 'upload') {
    return file.type.startsWith('video/') ? 'upload_video' : 'upload_photo';
  }
  return sourceType;
};

const uploadEndpointForSource = (sourceType: LibrarySourceType) =>
  sourceType === 'camera_photo' || sourceType === 'camera_video'
    ? `${API_BASE}/api/library/upload-camera`
    : `${API_BASE}/api/library/upload`;

const fetchWithFallback = async <T>(paths: string[]): Promise<T> => {
  let lastError: Error | null = null;

  for (const path of paths) {
    try {
      const res = await libraryFetch(path);
      return await handleJson<T>(res);
    } catch (error) {
      if (error instanceof ApiRouteNotFoundError) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('Route not found');
};

const fetchBucket = async <T extends LibraryItem>(path: string) => {
  const data = await fetchWithFallback<{ items: T[] }>([path]);
  return (data.items || []).map(normalizeItem);
};

export const libraryApi = {
  async getPatientLibrary(patientId: string): Promise<LibrarySummaryResponse> {
    const encodedPatientId = encodeURIComponent(patientId);
    const data = await fetchWithFallback<LibrarySummaryResponse | { counts: LibrarySummaryResponse['counts']; memories?: LibraryItem[]; diaryMedia?: LibraryItem[]; fitness?: LibraryItem[]; music?: LibraryItem[] }>([
      `${API_BASE}/api/library/patient/${encodedPatientId}`,
    ]);
    return {
      counts: data.counts || { memories: 0, diaryMedia: 0, fitness: 0, music: 0 },
      memories: ((data as LibrarySummaryResponse).memories || []).map(normalizeItem),
      diaryMedia: ((data as LibrarySummaryResponse).diaryMedia || []).map(normalizeItem),
      fitness: ((data as LibrarySummaryResponse).fitness || []).map(normalizeItem),
      music: ((data as LibrarySummaryResponse).music || []).map(normalizeItem),
    };
  },

  async getPatientMemories(patientId: string): Promise<LibraryMediaItem[]> {
    const encodedPatientId = encodeURIComponent(patientId);
    const data = await fetchWithFallback<{ items: LibraryMediaItem[] }>([
      `${API_BASE}/api/library/patient/${encodedPatientId}/memories`,
      `${API_BASE}/api/library/media?patientId=${encodedPatientId}&section=memories`,
    ]);
    return (data.items || []).map(normalizeItem);
  },

  async getPatientDiaryMedia(patientId: string): Promise<LibraryMediaItem[]> {
    const encodedPatientId = encodeURIComponent(patientId);
    const data = await fetchWithFallback<{ items: LibraryMediaItem[] }>([
      `${API_BASE}/api/library/patient/${encodedPatientId}/diary-media`,
      `${API_BASE}/api/library/media?patientId=${encodedPatientId}&section=diary`,
    ]);
    return (data.items || []).map(normalizeItem);
  },

  async getPatientFitness(patientId: string): Promise<LibraryFitnessItem[]> {
    const encodedPatientId = encodeURIComponent(patientId);
    const data = await fetchWithFallback<{ items: LibraryFitnessItem[] }>([
      `${API_BASE}/api/library/patient/${encodedPatientId}/fitness`,
      `${API_BASE}/api/library/fitness?patientId=${encodedPatientId}`,
    ]);
    return (data.items || []).map(normalizeItem);
  },

  async getPatientMusic(patientId: string): Promise<LibraryMusicItem[]> {
    const encodedPatientId = encodeURIComponent(patientId);
    const data = await fetchWithFallback<{ items: LibraryMusicItem[] }>([
      `${API_BASE}/api/library/patient/${encodedPatientId}/music`,
      `${API_BASE}/api/library/music?patientId=${encodedPatientId}`,
    ]);
    return (data.items || []).map(normalizeItem);
  },

  async createFitnessItem(params: {
    doctorId: string;
    youtube_url: string;
    title?: string;
    description?: string;
    category?: string;
  }): Promise<LibraryFitnessItem> {
    const res = await libraryFetch(`${API_BASE}/api/library/fitness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctorId: params.doctorId,
        youtube_url: params.youtube_url,
        youtubeUrl: params.youtube_url,
        title: params.title || '',
        description: params.description || '',
        category: params.category || '',
      }),
    });
    const data = await handleJson<{ item: LibraryFitnessItem }>(res);
    return normalizeItem(data.item);
  },

  async updateFitnessItem(params: {
    itemId: string;
    title?: string;
    description?: string;
    category?: string;
  }): Promise<LibraryFitnessItem> {
    const res = await libraryFetch(`${API_BASE}/api/library/fitness/${params.itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: params.title || '',
        description: params.description || '',
        category: params.category || '',
      }),
    });
    const data = await handleJson<{ item: LibraryFitnessItem }>(res);
    return normalizeItem(data.item);
  },

  async createMusicItem(params: {
    doctorId: string;
    spotify_url: string;
    title?: string;
    description?: string;
    category?: string;
  }): Promise<LibraryMusicItem> {
    const res = await libraryFetch(`${API_BASE}/api/library/music`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctorId: params.doctorId,
        spotify_url: params.spotify_url,
        spotifyUrl: params.spotify_url,
        title: params.title || '',
        description: params.description || '',
        category: params.category || '',
      }),
    });
    const data = await handleJson<{ item: LibraryMusicItem }>(res);
    return normalizeItem(data.item);
  },

  async updateMusicItem(params: {
    itemId: string;
    title?: string;
    description?: string;
  }): Promise<LibraryMusicItem> {
    const res = await libraryFetch(`${API_BASE}/api/library/music/${params.itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: params.title || '',
        description: params.description || '',
      }),
    });
    const data = await handleJson<{ item: LibraryMusicItem }>(res);
    return normalizeItem(data.item);
  },

  async uploadMemory(params: {
    patientId: string;
    sourceType: LibrarySourceType;
    file: File;
    capturedAt?: string;
  }): Promise<LibraryMediaItem> {
    const normalizedSourceType = normalizeSourceType(params.sourceType, params.file);
    const formData = new FormData();
    formData.append('patientId', params.patientId);
    formData.append('sourceType', normalizedSourceType);
    formData.append('file', params.file);
    if (params.capturedAt) formData.append('capturedAt', params.capturedAt);

    const res = await libraryFetch(uploadEndpointForSource(normalizedSourceType), {
      method: 'POST',
      body: formData,
    });
    const data = await handleJson<{ item: LibraryMediaItem }>(res);
    return normalizeItem(data.item);
  },

  async registerGoogleImport(params: {
    patientId: string;
    provider: 'google_photos' | 'google_drive';
    externalId: string;
    externalUrl: string;
    previewUrl?: string;
    mediaType: 'image' | 'video' | 'external';
    title?: string;
    description?: string;
  }): Promise<LibraryMediaItem> {
    const endpoint =
      params.provider === 'google_photos'
        ? `${API_BASE}/api/library/google/import/google-photos`
        : `${API_BASE}/api/library/google/import/google-drive`;

    const res = await libraryFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await handleJson<{ item: LibraryMediaItem }>(res);
    return normalizeItem(data.item);
  },

  async deleteLibraryItem(itemId: string) {
    const res = await libraryFetch(`${API_BASE}/api/library/item/${itemId}`, { method: 'DELETE' });
    return handleJson<{ success: boolean }>(res);
  },

  async getOverview(patientId: string): Promise<LibraryOverview> {
    const data = await this.getPatientLibrary(patientId);
    return {
      counts: {
        memories: data.counts.memories,
        diaryMedia: data.counts.diaryMedia,
      },
      latestMemories: data.memories.slice(0, 6),
      latestDiaryMedia: data.diaryMedia.slice(0, 6),
    };
  },

  async getMedia(params: {
    patientId: string;
    section?: LibrarySection;
    mediaType?: 'photo' | 'video';
    sourceType?: LibrarySourceType;
    date?: string;
  }): Promise<LibraryMediaItem[]> {
    const sourceItems =
      params.section === 'diary'
        ? await this.getPatientDiaryMedia(params.patientId)
        : await this.getPatientMemories(params.patientId);

    return sourceItems.filter((item) => {
      const matchesType =
        !params.mediaType ||
        (params.mediaType === 'photo' ? item.mediaType === 'image' : item.mediaType === 'video');
      const matchesSource = !params.sourceType || item.sourceType === params.sourceType;
      const matchesDate =
        !params.date ||
        [item.folderYear, item.folderMonth, item.folderDay].every(Boolean)
          ? `${item.folderYear}-${item.folderMonth}-${item.folderDay}` === params.date
          : item.uploadedAt?.slice(0, 10) === params.date;
      return matchesType && matchesSource && matchesDate;
    });
  },

  async uploadMedia(params: {
    patientId: string;
    section: LibrarySection;
    sourceType: LibrarySourceType;
    file: File;
    capturedAt?: string;
  }): Promise<LibraryMediaItem> {
    return this.uploadMemory({
      patientId: params.patientId,
      sourceType: params.sourceType,
      file: params.file,
      capturedAt: params.capturedAt,
    });
  },

  async registerImport(params: {
    patientId: string;
    provider: 'google_photos' | 'google_drive';
    externalId: string;
    externalUrl: string;
    previewUrl?: string;
    mediaType: 'photo' | 'video';
  }): Promise<LibraryMediaItem> {
    return this.registerGoogleImport({
      ...params,
      mediaType: params.mediaType === 'photo' ? 'image' : 'video',
    });
  },

  async deleteMedia(mediaId: string) {
    return this.deleteLibraryItem(mediaId);
  },

  async getFitness(filters?: { patientId?: string; trimester?: string; month?: number; week?: number }): Promise<LibraryFitnessItem[]> {
    const items = filters?.patientId
      ? await this.getPatientFitness(filters.patientId)
      : await fetchBucket<LibraryFitnessItem>(`${API_BASE}/api/library/fitness`);
    return items.filter((item) => {
      const trimesterMatch =
        !filters?.trimester ||
        filters.trimester === 'all' ||
        item.trimester === filters.trimester ||
        item.trimester === 'all';
      const monthMatch = !filters?.month || item.pregnancyMonth === filters.month;
      const weekMatch = !filters?.week || item.pregnancyWeek === filters.week;
      return trimesterMatch && monthMatch && weekMatch;
    });
  },

  async getMusic(patientId?: string): Promise<LibraryMusicItem[]> {
    if (patientId) return this.getPatientMusic(patientId);
    return fetchBucket<LibraryMusicItem>(`${API_BASE}/api/library/music`);
  },

  async searchPatients(query = ''): Promise<LibraryPatientOption[]> {
    const res = await libraryFetch(`${API_BASE}/api/library/admin/patients?query=${encodeURIComponent(query)}`);
    const data = await handleJson<{ items: LibraryPatientOption[] }>(res);
    return data.items || [];
  },
};

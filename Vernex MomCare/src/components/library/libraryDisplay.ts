import type { LibraryItem, LibrarySourceType } from '@/types/library';

const sourceOrder: LibrarySourceType[] = [
  'camera_photo',
  'camera_video',
  'upload_photo',
  'upload_video',
  'google_photos',
  'google_drive',
  'diary_photo',
  'diary_video',
];

export const sourceLabels: Record<string, string> = {
  camera_photo: 'Camera Photos',
  camera_video: 'Camera Videos',
  upload_photo: 'Uploaded Photos',
  upload_video: 'Uploaded Videos',
  google_photos: 'Google Photos Imported Media',
  google_drive: 'Google Drive Imported Media',
  diary_photo: 'Diary Photo',
  diary_video: 'Diary Video',
  upload: 'Uploaded Media',
};

export const mediaLabels: Record<string, string> = {
  image: 'Photo',
  video: 'Video',
  youtube: 'Video',
  spotify: 'Music',
  external: 'External',
};

export const getSourceLabel = (sourceType: string) =>
  sourceLabels[sourceType] || sourceType.replace(/_/g, ' ');

export const getMediaDateLabel = (item: LibraryItem) => {
  if (item.folderYear && item.folderMonth && item.folderDay) {
    return `${item.folderYear}-${item.folderMonth}-${item.folderDay}`;
  }
  return item.uploadedAt ? new Date(item.uploadedAt).toISOString().slice(0, 10) : 'Unknown date';
};

export const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : 'Not recorded';

export const groupItemsBySourceAndDate = (items: LibraryItem[]) =>
  sourceOrder
    .map((sourceType) => ({
      sourceType,
      items: items.filter((item) => item.sourceType === sourceType),
    }))
    .filter((group) => group.items.length > 0)
    .map((group) => ({
      ...group,
      dateGroups: Object.entries(
        group.items.reduce<Record<string, LibraryItem[]>>((acc, item) => {
          const key = getMediaDateLabel(item);
          acc[key] = acc[key] || [];
          acc[key].push(item);
          return acc;
        }, {})
      ).sort((a, b) => b[0].localeCompare(a[0])),
    }));

export const getItemSearchText = (item: LibraryItem) =>
  [
    item.title,
    item.description,
    item.sourceAuthority,
    getSourceLabel(item.sourceType),
    getMediaDateLabel(item),
    ...(item.tags || []),
  ]
    .join(' ')
    .toLowerCase();

type SpotifyEmbedType = 'track' | 'playlist' | 'album';

const parseUrl = (value: string) => {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
};

export function extractYouTubeId(url: string) {
  const parsed = parseUrl(url);
  if (!parsed) return '';

  const host = parsed.hostname.toLowerCase();
  if (host.includes('youtu.be')) {
    return parsed.pathname.split('/').filter(Boolean)[0] || '';
  }

  if (!host.includes('youtube.com')) return '';

  const direct = parsed.searchParams.get('v');
  if (direct) return direct;

  const parts = parsed.pathname.split('/').filter(Boolean);
  const embedIndex = parts.findIndex((part) => part === 'embed' || part === 'shorts');
  return embedIndex >= 0 ? parts[embedIndex + 1] || '' : '';
}

export async function fetchYouTubeMetadata(url: string) {
  const response = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
  );

  if (!response.ok) {
    throw new Error('Unable to fetch YouTube metadata');
  }

  const data = await response.json();
  return {
    title: data?.title || '',
    authorName: data?.author_name || '',
  };
}

export async function fetchSpotifyMetadata(url: string) {
  const response = await fetch(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
  );

  if (!response.ok) {
    throw new Error('Unable to fetch Spotify metadata');
  }

  const data = await response.json();
  return {
    title: data?.title || '',
    authorName: data?.author_name || '',
    thumbnailUrl: data?.thumbnail_url || '',
  };
}

export function extractSpotifyId(url: string): { id: string; type: SpotifyEmbedType } | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;

  const host = parsed.hostname.toLowerCase();
  if (!host.includes('spotify.com')) return null;

  const [type, id] = parsed.pathname.split('/').filter(Boolean);
  if (!id || (type !== 'track' && type !== 'playlist' && type !== 'album')) return null;

  return { id, type };
}

export const getYouTubeEmbedUrl = (videoId?: string) =>
  videoId ? `https://www.youtube.com/embed/${videoId}` : '';

export const getYouTubeThumbnailUrl = (videoId?: string) =>
  videoId ? `https://img.youtube.com/vi/${videoId}/0.jpg` : '';

export const getSpotifyEmbedUrl = (id?: string, type?: string) =>
  id && (type === 'track' || type === 'playlist' || type === 'album')
    ? `https://open.spotify.com/embed/${type}/${id}`
    : '';

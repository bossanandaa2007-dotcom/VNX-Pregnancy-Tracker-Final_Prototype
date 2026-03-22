const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

const SPOTIFY_HOSTS = new Set([
  "open.spotify.com",
  "play.spotify.com",
]);

const safeParseUrl = (value) => {
  try {
    return new URL(String(value || "").trim());
  } catch (error) {
    return null;
  }
};

const extractYouTubeId = (value) => {
  const url = safeParseUrl(value);
  if (!url || !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return "";

  if (url.hostname.toLowerCase().includes("youtu.be")) {
    const id = url.pathname.split("/").filter(Boolean)[0] || "";
    return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : "";
  }

  const direct = url.searchParams.get("v") || "";
  if (/^[A-Za-z0-9_-]{6,}$/.test(direct)) return direct;

  const pathParts = url.pathname.split("/").filter(Boolean);
  const embedIndex = pathParts.findIndex((part) => part === "embed" || part === "shorts");
  if (embedIndex >= 0) {
    const id = pathParts[embedIndex + 1] || "";
    return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : "";
  }

  return "";
};

const fetchYouTubeMetadata = async (youtubeUrl) => {
  const targetUrl = String(youtubeUrl || "").trim();
  if (!targetUrl) return null;

  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      title: data?.title || "",
      authorName: data?.author_name || "",
    };
  } catch (error) {
    return null;
  }
};

const fetchSpotifyMetadata = async (spotifyUrl) => {
  const targetUrl = String(spotifyUrl || "").trim();
  if (!targetUrl) return null;

  const endpoint = `https://open.spotify.com/oembed?url=${encodeURIComponent(targetUrl)}`;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      title: data?.title || "",
      authorName: data?.author_name || "",
      thumbnailUrl: data?.thumbnail_url || "",
    };
  } catch (error) {
    return null;
  }
};

const extractSpotifyId = (value) => {
  const url = safeParseUrl(value);
  if (!url || !SPOTIFY_HOSTS.has(url.hostname.toLowerCase())) return null;

  const parts = url.pathname.split("/").filter(Boolean);
  const type = parts[0] || "";
  const id = parts[1] || "";

  if (!["track", "playlist", "album"].includes(type) || !/^[A-Za-z0-9]+$/.test(id)) {
    return null;
  }

  return { id, type };
};

const buildYouTubeEmbedUrl = (videoId) =>
  videoId ? `https://www.youtube.com/embed/${videoId}` : "";

const buildYouTubeThumbnailUrl = (videoId) =>
  videoId ? `https://img.youtube.com/vi/${videoId}/0.jpg` : "";

const buildSpotifyEmbedUrl = ({ id, type }) =>
  id && type ? `https://open.spotify.com/embed/${type}/${id}` : "";

module.exports = {
  buildSpotifyEmbedUrl,
  buildYouTubeEmbedUrl,
  buildYouTubeThumbnailUrl,
  extractSpotifyId,
  extractYouTubeId,
  fetchSpotifyMetadata,
  fetchYouTubeMetadata,
};

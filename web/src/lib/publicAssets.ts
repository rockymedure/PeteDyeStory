type ClipLike = {
  filename: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  video?: { filename: string };
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

function isLocalhost() {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function supabasePublicUrl(bucket: string, objectName: string) {
  if (!SUPABASE_URL) return null;
  // objectName here is a single "filename-like" segment (no slashes expected)
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(objectName)}`;
}

function derivedBaseName(clip: ClipLike) {
  const videoFilename = (clip.video?.filename || '').replace(/-/g, '_');
  const clipName = clip.filename?.replace('.mp4', '') || '';
  return `${videoFilename}__${clipName}`;
}

export function resolveThumbnailUrl(clip: ClipLike): string {
  // If DB already provides a URL/path, respect it.
  if (clip.thumbnail_path) {
    if (clip.thumbnail_path.startsWith('http://') || clip.thumbnail_path.startsWith('https://')) {
      return clip.thumbnail_path;
    }

    // Local dev convenience (symlinked /public/thumbnails)
    if (clip.thumbnail_path.startsWith('/')) return clip.thumbnail_path;

    // Treat as storage object name/path
    const objectName = clip.thumbnail_path.replace(/^\/+/, '');
    return supabasePublicUrl('thumbnails', objectName) ?? `/${objectName}`;
  }

  const filename = `${derivedBaseName(clip)}.jpg`;

  // Local dev uses the symlinked public folder
  if (isLocalhost()) return `/thumbnails/${filename}`;

  // Production: load from Supabase Storage (public bucket)
  return supabasePublicUrl('thumbnails', filename) ?? `/thumbnails/${filename}`;
}

export function resolveClipUrl(clip: ClipLike): string {
  if (clip.storage_path) {
    if (clip.storage_path.startsWith('http://') || clip.storage_path.startsWith('https://')) {
      return clip.storage_path;
    }
    if (clip.storage_path.startsWith('/')) return clip.storage_path;

    const objectName = clip.storage_path.replace(/^\/+/, '');
    return supabasePublicUrl('clips', objectName) ?? `/${objectName}`;
  }

  const filename = `${derivedBaseName(clip)}.mp4`;
  if (isLocalhost()) return `/clips/${filename}`;
  return supabasePublicUrl('clips', filename) ?? `/clips/${filename}`;
}


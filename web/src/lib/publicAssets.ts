type ClipLike = {
  filename: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  video?: { filename: string };
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * In local dev we serve clips/thumbnails from the symlinked public/ folder.
 * On Railway (or any non-local deploy) we serve from Supabase Storage.
 *
 * We use NODE_ENV to decide — this is stable across server and client renders
 * so it won't cause a hydration mismatch.
 */
const IS_DEV = process.env.NODE_ENV === 'development';

function supabasePublicUrl(bucket: string, objectName: string) {
  if (!SUPABASE_URL) return null;
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
    if (clip.thumbnail_path.startsWith('/')) return clip.thumbnail_path;

    const objectName = clip.thumbnail_path.replace(/^\/+/, '');
    return supabasePublicUrl('thumbnails', objectName) ?? `/${objectName}`;
  }

  const filename = `${derivedBaseName(clip)}.jpg`;

  // Dev: use the symlinked /public/thumbnails folder
  if (IS_DEV) return `/thumbnails/${filename}`;

  // Production: load from Supabase Storage
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
  if (IS_DEV) return `/clips/${filename}`;
  return supabasePublicUrl('clips', filename) ?? `/clips/${filename}`;
}

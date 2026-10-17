/**
 * Utilitas untuk mengekstrak Video ID YouTube dari berbagai format URL:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/watch?feature=shared&v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://youtu.be/VIDEO_ID?si=xxx
 * - https://www.youtube.com/live/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 */
export function extractYouTubeVideoId(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.trim();
  if (!cleanUrl) return null;

  try {
    const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    // 1. Format pendek youtu.be/VIDEO_ID
    if (hostname === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0].split('?')[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
        return id;
      }
    }

    // 2. Format youtube.com atau m.youtube.com
    if (hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname.endsWith('.youtube.com')) {
      // Query param: ?v=VIDEO_ID
      const v = parsed.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
        return v;
      }

      // Path: /live/VIDEO_ID, /embed/VIDEO_ID, /shorts/VIDEO_ID, /v/VIDEO_ID
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (['live', 'embed', 'shorts', 'v'].includes(pathParts[0]) && pathParts[1]) {
        const id = pathParts[1].split('?')[0];
        if (/^[a-zA-Z0-9_-]{11}$/.test(id)) {
          return id;
        }
      }
    }
  } catch {
    // Abaikan error parsing URL, lanjut ke regex fallback
  }

  // Fallback regex universal untuk URL non-standar
  const match = cleanUrl.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:.*[?&]v=|embed\/|live\/|shorts\/|v\/))([a-zA-Z0-9_-]{11})/i
  );
  return match ? match[1] : null;
}

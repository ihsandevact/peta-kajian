import * as cheerio from 'cheerio';
import { supabase } from '@/lib/supabase';
import { createAdminClient } from '@/utils/supabase/admin';

export interface UpcomingStreamItem {
  videoId: string;
  title: string;
  scheduledStartTime: string; // Format ISO 8601
  posterUrl: string;
  streamUrl: string;
  speakerName: string;
  channelName?: string;
}

export interface EndedStreamItem {
  videoId: string;
  title: string;
  endedAt?: string; // Format ISO 8601
  startedAt?: string; // Format ISO 8601
  posterUrl: string;
  streamUrl: string;
  speakerName: string;
  channelName?: string;
}

export interface YoutubeChannel {
  id: string;
  channel_name: string;
  channel_handle: string;
  channel_id?: string | null;
  avatar_url?: string | null;
  default_speaker_name?: string | null;
  default_city?: string | null;
  is_active: boolean;
  is_currently_live: boolean;
  current_video_id?: string | null;
  current_video_title?: string | null;
  current_session_id?: string | null;
  upcoming_streams?: UpcomingStreamItem[] | null;
  ended_streams?: EndedStreamItem[] | null;
  last_checked_at?: string | null;
  last_live_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveDetectionResult {
  handle: string;
  channelId?: string | null;
  isLive: boolean;
  videoId: string | null;
  title: string;
  posterUrl: string | null;
  streamUrl: string | null;
  speakerName: string;
  upcomingStreams?: UpcomingStreamItem[];
  endedStreams?: EndedStreamItem[];
  error?: string | null;
}

export interface ChannelSyncReport {
  channelId: string;
  channelName: string;
  handle: string;
  status: 'live_new' | 'live_existing' | 'offline' | 'error';
  videoId?: string | null;
  title?: string | null;
  sessionId?: string | null;
  upcomingCount?: number;
  endedCount?: number;
  message?: string;
}

export interface ResolvedYoutubeChannel {
  handle: string;
  channelName: string;
  defaultSpeakerName: string;
}

/**
 * Header standar browser dengan cookie bypass Google Consent dialog (SOCS & CONSENT)
 */
export const YOUTUBE_FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cookie': 'SOCS=CAESEwgDEgk2MTQ1NzU1OTQaAmVuIAEaBgiA_LyaBg; CONSENT=PENDING+999; PREF=tz=Asia.Jakarta&f6=40000000',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-Dest': 'document',
};

/**
 * Membersihkan decode HTML entities dari string judul / teks
 */
export function cleanHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * Normalisasi format handle (@username)
 */
export function normalizeHandle(handle: string): string {
  const clean = handle.trim().toLowerCase().replace(/^https?:\/\/(www\.)?youtube\.com\//i, '').replace(/^\/+/, '');
  return clean.startsWith('@') ? clean : `@${clean}`;
}

/**
 * Menyelesaikan URL siaran/video/channel YouTube menjadi handle dan nama channel yang valid
 */
export async function resolveYoutubeChannelInfo(
  streamUrl: string,
  fallbackSpeaker?: string | null
): Promise<ResolvedYoutubeChannel | null> {
  if (!streamUrl || typeof streamUrl !== 'string') return null;

  const isYoutube = /(?:youtube\.com|youtu\.be)/i.test(streamUrl);
  if (!isYoutube) return null;

  try {
    // 1. Cek apakah URL langsung berupa format handle: youtube.com/@handle
    const directHandleMatch = streamUrl.match(/@([a-zA-Z0-9_.-]+)/);
    if (directHandleMatch) {
      const handle = normalizeHandle(`@${directHandleMatch[1]}`);

      let channelName = fallbackSpeaker?.trim() || handle.replace('@', '');
      try {
        const res = await fetch(`https://www.youtube.com/${handle}`, {
          headers: YOUTUBE_FETCH_HEADERS,
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const html = await res.text();
          const authorMatch =
            html.match(/"channelMetadataRenderer":\s*\{"title":"([^"]+)"/)?.[1] ||
            html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ||
            html.match(/<title>([^<]+)<\/title>/)?.[1]?.replace(/\s*-\s*YouTube\s*$/i, '');
          if (authorMatch && !authorMatch.includes('404')) {
            channelName = cleanHtmlEntities(authorMatch);
          }
        }
      } catch {
        // Fallback ke channelName awal
      }

      return {
        handle,
        channelName,
        defaultSpeakerName: fallbackSpeaker?.trim() || 'Asatidzah',
      };
    }

    // 2. Jika berupa video / live link: youtube.com/watch?v=..., youtu.be/..., youtube.com/live/...
    const targetUrl = streamUrl.startsWith('http') ? streamUrl : `https://${streamUrl}`;
    const res = await fetch(targetUrl, {
      headers: YOUTUBE_FETCH_HEADERS,
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    const handleMatch =
      html.match(/"canonicalBaseUrl":"\/@([^"]+)"/)?.[1] ||
      html.match(/href="https:\/\/www\.youtube\.com\/@([^"]+)"/)?.[1] ||
      html.match(/"channelUrl":"https:\/\/www\.youtube\.com\/@([^"]+)"/)?.[1];

    if (!handleMatch) {
      return null;
    }

    const handle = normalizeHandle(`@${handleMatch}`);

    const authorMatch =
      html.match(/"author":"([^"]+)"/)?.[1] ||
      html.match(/<link itemprop="name" content="([^"]+)">/)?.[1] ||
      html.match(/<meta property="og:video:actor" content="([^"]+)"/)?.[1];

    let channelName = authorMatch
      ? cleanHtmlEntities(authorMatch)
      : (fallbackSpeaker?.trim() || handle.replace('@', ''));

    return {
      handle,
      channelName,
      defaultSpeakerName: fallbackSpeaker?.trim() || 'Asatidzah',
    };
  } catch (err) {
    console.warn(`Gagal me-resolve YouTube channel dari URL ${streamUrl}:`, err);
    return null;
  }
}


/**
 * Ekstraksi nama Ustadz / Pemateri secara otomatis dari judul video
 */
export function extractSpeakerFromTitle(title: string, defaultSpeaker = 'Asatidzah'): string {
  if (!title) return defaultSpeaker;

  // Tangkap seluruh nama beserta gelar kehormatannya (Buya, Habib, Syaikh, Kyai, Ust/Ustadz)
  const patterns = [
    /(?:(?:Kajian\s+)?(?:Bersama|Oleh)\s+)((?:Ust(?:adz)?\.?|Syaikh|Buya|Habib|Kyai\s+)?([A-Za-z\s,.'\-]+?))(?:\s*(?:\||-|–|—|\(|\)|\[|\]|#|\d{1,2}\s+[A-Za-z]+|\/|$))/i,
    /(?:Pemateri\s*:?\s*)((?:Ust(?:adz)?\.?|Syaikh|Buya|Habib|Kyai\s+)?([A-Za-z\s,.'\-]+?))(?:\s*(?:\||-|–|—|\(|\)|\[|\]|#|$))/i,
    /((?:Ust(?:adz)?\.?|Syaikh|Buya|Habib|Kyai)\s+[A-Za-z\s,.'\-]+?)(?:\s*(?:\||-|–|—|\(|\)|\[|\]|#|\d{1,2}\s+[A-Za-z]+|\/|$))/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate.length >= 3 && candidate.length <= 50) {
        // Lengkapi dengan prefix Ust. jika belum ada gelar kehormatan
        if (!/^(ust|syaikh|buya|habib|kyai)/i.test(candidate)) {
          return `Ust. ${candidate}`;
        }
        return candidate;
      }
    }
  }

  return defaultSpeaker || 'Asatidzah';
}

/**
 * Format string tanggal waktu ISO ke teks ramah bahasa Indonesia untuk siaran upcoming
 * Contoh: "Hari ini, 18:15 WIB", "Besok, 13:00 WIB", atau "Ahad, 19 Okt • 09:00 WIB"
 */
export function formatUpcomingTime(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    const now = new Date();

    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      d.getDate() === tomorrow.getDate() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getFullYear() === tomorrow.getFullYear();

    const timeStr = d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta',
    });

    if (isToday) return `Hari ini, ${timeStr} WIB`;
    if (isTomorrow) return `Besok, ${timeStr} WIB`;

    const dayName = d.toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' });
    const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });
    return `${dayName}, ${dateStr} • ${timeStr} WIB`;
  } catch {
    return 'Segera Tayang';
  }
}

/**
 * Format string tanggal waktu ISO ke teks ramah bahasa Indonesia untuk rekaman siaran yang telah berakhir
 * Contoh: "Hari ini, 11:30 WIB", "Kemarin, 20:00 WIB", atau "Ahad, 19 Okt • 09:00 WIB"
 */
export function formatEndedTime(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    const now = new Date();

    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    const timeStr = d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta',
    });

    if (isToday) return `Hari ini, ${timeStr} WIB`;
    if (isYesterday) return `Kemarin, ${timeStr} WIB`;

    const dayName = d.toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' });
    const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });
    return `${dayName}, ${dateStr} • ${timeStr} WIB`;
  } catch {
    return 'Selesai Tayang';
  }
}

/**
 * Mengecek status live sebuah video ID secara presisi menggunakan YouTube InnerTube Player API (JSON).
 * Endpoint ini tidak membutuhkan API key, sangat cepat (~200ms), dan tidak pernah dicegat
 * oleh Bot Captcha di datacenter cloud (seperti server Vercel/AWS).
 */
export async function verifyVideoLiveStatusInnerTube(videoId: string): Promise<{
  isLive: boolean;
  isUpcoming?: boolean;
  scheduledStartTime?: string | null;
  title?: string;
  playerDetails?: any;
}> {
  if (!videoId || videoId.length !== 11) return { isLive: false, isUpcoming: false };

  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': YOUTUBE_FETCH_HEADERS['User-Agent'],
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240410.01.00',
          },
        },
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return { isLive: false, isUpcoming: false };
    const data = await res.json();

    const playabilityStatus = data?.playabilityStatus;
    const videoDetails = data?.videoDetails;
    const liveBroadcast = data?.microformat?.playerMicroformatRenderer?.liveBroadcastDetails;

    const isOffline =
      playabilityStatus?.status === 'LIVE_STREAM_OFFLINE' ||
      playabilityStatus?.reason?.toLowerCase().includes('ended') ||
      playabilityStatus?.reason?.toLowerCase().includes('berakhir');

    const hasLiveMarker =
      liveBroadcast?.isLiveNow === true ||
      videoDetails?.isLive === true ||
      (videoDetails?.isLiveContent === true && (videoDetails?.lengthSeconds === '0' || !videoDetails?.lengthSeconds)) ||
      Boolean(playabilityStatus?.liveStreamability?.liveStreamabilityRenderer);

    const isLive = !isOffline && Boolean(hasLiveMarker);

    // Deteksi Upcoming Stream via InnerTube
    const isUpcoming =
      !isLive &&
      Boolean(
        liveBroadcast?.startTimestamp ||
        playabilityStatus?.liveStreamability?.liveStreamabilityRenderer?.offlineSlate?.liveStreamOfflineSlateRenderer?.scheduledStartTime ||
        videoDetails?.isUpcoming === true
      ) &&
      !playabilityStatus?.reason?.toLowerCase().includes('ended') &&
      !playabilityStatus?.reason?.toLowerCase().includes('berakhir');

    let scheduledStartTime: string | null = null;
    if (isUpcoming) {
      if (liveBroadcast?.startTimestamp) {
        scheduledStartTime = liveBroadcast.startTimestamp;
      } else if (playabilityStatus?.liveStreamability?.liveStreamabilityRenderer?.offlineSlate?.liveStreamOfflineSlateRenderer?.scheduledStartTime) {
        const sec = Number(playabilityStatus.liveStreamability.liveStreamabilityRenderer.offlineSlate.liveStreamOfflineSlateRenderer.scheduledStartTime);
        if (!isNaN(sec) && sec > 0) {
          scheduledStartTime = new Date(sec * 1000).toISOString();
        }
      }
    }

    return {
      isLive,
      isUpcoming,
      scheduledStartTime,
      title: videoDetails?.title || undefined,
      playerDetails: data,
    };
  } catch {
    return { isLive: false, isUpcoming: false };
  }
}

/**
 * Pengecekan status Live siaran YouTube via YouTube Data API v3 resmi.
 * Menggunakan pendekatan hemat kuota (1 kuota per panggilan) via playlist Uploads (UU...).
 * 100% legal, deterministik, dan kebal dari Captcha/bot protection di cloud (Vercel).
 */
export async function checkChannelLiveViaApi(
  channelIdOrHandle: string,
  apiKey: string,
  defaultSpeaker?: string | null,
  knownChannelId?: string | null
): Promise<LiveDetectionResult | null> {
  if (!apiKey) return null;

  try {
    let channelId = knownChannelId || (channelIdOrHandle.startsWith('UC') ? channelIdOrHandle : null);
    let uploadsPlaylistId = channelId ? (channelId.startsWith('UC') ? `UU${channelId.slice(2)}` : `UU${channelId}`) : null;

    // Jika channelId kanonik belum diketahui, resolve via channels.list forHandle (1 kuota)
    if (!uploadsPlaylistId) {
      const handleClean = channelIdOrHandle.replace(/^@/, '');
      const chRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=id,contentDetails,snippet&forHandle=${encodeURIComponent(handleClean)}&key=${apiKey}`,
        { cache: 'no-store', signal: AbortSignal.timeout(6000) }
      );
      if (!chRes.ok) return null;
      const chData = await chRes.json();
      const chItem = chData.items?.[0];
      if (!chItem) return null;

      channelId = chItem.id;
      uploadsPlaylistId = chItem.contentDetails?.relatedPlaylists?.uploads || (channelId ? `UU${channelId.slice(2)}` : null);
    }

    if (!uploadsPlaylistId) return null;

    // 1. Ambil hingga 8 video terbaru dari playlist Uploads channel (1 kuota)
    const playlistRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=8&key=${apiKey}`,
      { cache: 'no-store', signal: AbortSignal.timeout(6000) }
    );

    if (!playlistRes.ok) {
      return null;
    }

    const playlistData = await playlistRes.json();
    const items = playlistData.items || [];
    if (items.length === 0) {
      return {
        handle: channelIdOrHandle,
        channelId,
        isLive: false,
        videoId: null,
        title: '',
        posterUrl: null,
        streamUrl: null,
        speakerName: defaultSpeaker || 'Asatidzah',
        upcomingStreams: [],
        endedStreams: [],
      };
    }

    const videoIds = items
      .map((item: any) => item.snippet?.resourceId?.videoId)
      .filter(Boolean);

    if (videoIds.length === 0) {
      return {
        handle: channelIdOrHandle,
        channelId,
        isLive: false,
        videoId: null,
        title: '',
        posterUrl: null,
        streamUrl: null,
        speakerName: defaultSpeaker || 'Asatidzah',
        upcomingStreams: [],
        endedStreams: [],
      };
    }

    // 2. Periksa status live, upcoming, dan rekaman siaran berakhir pada video terbaru
    const videosRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails,status&id=${videoIds.join(',')}&key=${apiKey}`,
      { cache: 'no-store', signal: AbortSignal.timeout(6000) }
    );

    if (!videosRes.ok) return null;
    const videosData = await videosRes.json();
    const videoItems = videosData.items || [];

    let activeLiveStream: {
      videoId: string;
      title: string;
      speakerName: string;
      posterUrl: string;
      streamUrl: string;
      channelTitle?: string;
    } | null = null;

    const upcomingStreams: UpcomingStreamItem[] = [];
    const endedStreams: EndedStreamItem[] = [];
    const nowMs = Date.now();
    const maxFutureMs = nowMs + 48 * 60 * 60 * 1000; // Siaran 48 jam ke depan

    for (const vid of videoItems) {
      // Periksa status privasi: Jangan proses video yang disetel private atau dilarang di-embed
      const vidStatus = vid.status;
      if (vidStatus) {
        const isPublic = vidStatus.privacyStatus === 'public';
        const isEmbeddable = vidStatus.embeddable !== false;
        if (!isPublic || !isEmbeddable) {
          continue;
        }
      }

      const snippet = vid.snippet;
      const liveDetails = vid.liveStreamingDetails;
      const liveBroadcastContent = snippet?.liveBroadcastContent; // 'live' | 'upcoming' | 'none'

      // Terverifikasi live jika status siaran adalah 'live' ATAU
      // actualStartTime ada dan actualEndTime belum ada
      const isCurrentlyLive =
        liveBroadcastContent === 'live' ||
        (Boolean(liveDetails?.actualStartTime) && !liveDetails?.actualEndTime);

      const isEndedLive =
        Boolean(liveDetails?.actualEndTime) ||
        (Boolean(liveDetails?.actualStartTime) && liveBroadcastContent === 'none');

      if (isCurrentlyLive && !activeLiveStream) {
        const videoId = vid.id;
        const title = cleanHtmlEntities(snippet?.title || '');
        const speakerName = extractSpeakerFromTitle(title, defaultSpeaker || 'Asatidzah');
        const posterUrl =
          snippet?.thumbnails?.maxres?.url ||
          snippet?.thumbnails?.high?.url ||
          snippet?.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        activeLiveStream = {
          videoId,
          title,
          speakerName,
          posterUrl,
          streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
          channelTitle: snippet?.channelTitle,
        };
      } else if (
        liveBroadcastContent === 'upcoming' &&
        liveDetails?.scheduledStartTime
      ) {
        const schedMs = new Date(liveDetails.scheduledStartTime).getTime();
        // Rentang hingga 48 jam ke depan (atau toleransi 15 menit jika sedikit terlambat mulai)
        if (schedMs >= nowMs - 15 * 60 * 1000 && schedMs <= maxFutureMs) {
          const videoId = vid.id;
          const title = cleanHtmlEntities(snippet?.title || '');
          const speakerName = extractSpeakerFromTitle(title, defaultSpeaker || 'Asatidzah');
          const posterUrl =
            snippet?.thumbnails?.maxres?.url ||
            snippet?.thumbnails?.high?.url ||
            snippet?.thumbnails?.default?.url ||
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

          upcomingStreams.push({
            videoId,
            title,
            scheduledStartTime: liveDetails.scheduledStartTime,
            posterUrl,
            streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
            speakerName,
            channelName: snippet?.channelTitle,
          });
        }
      } else if (isEndedLive) {
        const videoId = vid.id;
        const title = cleanHtmlEntities(snippet?.title || '');
        const speakerName = extractSpeakerFromTitle(title, defaultSpeaker || 'Asatidzah');
        const posterUrl =
          snippet?.thumbnails?.maxres?.url ||
          snippet?.thumbnails?.high?.url ||
          snippet?.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        endedStreams.push({
          videoId,
          title,
          endedAt: liveDetails?.actualEndTime || liveDetails?.actualStartTime || snippet?.publishedAt,
          startedAt: liveDetails?.actualStartTime,
          posterUrl,
          streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
          speakerName,
          channelName: snippet?.channelTitle,
        });
      }
    }

    // Urutkan siaran upcoming berdasarkan jadwal terdekat
    upcomingStreams.sort(
      (a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime()
    );

    // Urutkan rekaman siaran berakhir dari yang paling baru selesai (descending)
    endedStreams.sort(
      (a, b) => new Date(b.endedAt || 0).getTime() - new Date(a.endedAt || 0).getTime()
    );
    const limitedEndedStreams = endedStreams.slice(0, 6);

    if (activeLiveStream) {
      return {
        handle: activeLiveStream.channelTitle || channelIdOrHandle,
        channelId,
        isLive: true,
        videoId: activeLiveStream.videoId,
        title: activeLiveStream.title,
        posterUrl: activeLiveStream.posterUrl,
        streamUrl: activeLiveStream.streamUrl,
        speakerName: activeLiveStream.speakerName,
        upcomingStreams,
        endedStreams: limitedEndedStreams,
      };
    }

    return {
      handle: items[0]?.snippet?.channelTitle || channelIdOrHandle,
      channelId,
      isLive: false,
      videoId: null,
      title: '',
      posterUrl: null,
      streamUrl: null,
      speakerName: defaultSpeaker || 'Asatidzah',
      upcomingStreams,
      endedStreams: limitedEndedStreams,
    };
  } catch (err) {
    console.warn(`[checkChannelLiveViaApi] Error for ${channelIdOrHandle}:`, err);
    return null;
  }
}

/**
 * Pengecekan status Live siaran YouTube via canonical endpoint (0 Quota)
 */
export async function checkChannelLiveStatus(
  rawHandle: string,
  defaultSpeaker?: string | null,
  knownChannelId?: string | null
): Promise<LiveDetectionResult> {
  const handle = normalizeHandle(rawHandle);

  // Tentukan URL target: prioritaskan channel ID kanonik jika tersedia, atau gunakan handle
  const primaryUrl = knownChannelId
    ? `https://www.youtube.com/channel/${knownChannelId}/live`
    : `https://www.youtube.com/${handle}/live`;

  try {
    let res = await fetch(primaryUrl, {
      headers: YOUTUBE_FETCH_HEADERS,
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    // Jika target URL pertama 404 dan tadi menggunakan channel ID, coba URL alternatif via handle
    if (res.status === 404 && knownChannelId) {
      res = await fetch(`https://www.youtube.com/${handle}/live`, {
        headers: YOUTUBE_FETCH_HEADERS,
        redirect: 'follow',
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
    }

    const html = await res.text();
    const finalUrl = res.url || '';

    // Temukan channelId kanonik jika belum ada
    let channelId = knownChannelId || null;
    if (!channelId) {
      const chMatch =
        html.match(/"channelId":"([a-zA-Z0-9_-]{24})"/)?.[1] ||
        html.match(/"externalChannelId":"([a-zA-Z0-9_-]{24})"/)?.[1] ||
        html.match(/<meta itemprop="channelId" content="([a-zA-Z0-9_-]{24})">/)?.[1];
      if (chMatch) channelId = chMatch;
    }

    // Ekstraksi ytInitialPlayerResponse secara aman
    let playerObj: any = null;
    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]+?});(?:var|<\/script>)/);
    if (playerMatch) {
      try {
        playerObj = JSON.parse(playerMatch[1]);
      } catch {
        // Abaikan parse error jika JSON terpotong
      }
    }

    // Cek Video ID dari URL final atau canonical link
    let videoId: string | null = null;
    if (finalUrl.includes('/watch?v=')) {
      const match = finalUrl.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
      if (match) videoId = match[1];
    }

    if (!videoId && playerObj?.videoDetails?.videoId) {
      videoId = playerObj.videoDetails.videoId;
    }

    if (!videoId) {
      const match = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/);
      if (match) videoId = match[1];
    }

    if (!videoId) {
      const vidMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      if (vidMatch) videoId = vidMatch[1];
    }

    // 1. Evaluasi status siaran LIVE secara deterministik (Scoped ke Player Utama)
    let isLive = false;

    const upcomingStreams: UpcomingStreamItem[] = [];
    const nowMs = Date.now();
    const maxFutureMs = nowMs + 48 * 60 * 60 * 1000;

    if (playerObj && videoId) {
      const videoDetails = playerObj.videoDetails;
      const playabilityStatus = playerObj.playabilityStatus;
      const liveBroadcast = playerObj.microformat?.playerMicroformatRenderer?.liveBroadcastDetails;

      const isStatusOk = playabilityStatus?.status === 'OK';
      const hasLiveStreamability = Boolean(playabilityStatus?.liveStreamability?.liveStreamabilityRenderer);
      const isPlayerEnded =
        playabilityStatus?.status === 'LIVE_STREAM_OFFLINE' ||
        playerObj.playabilityStatus?.reason?.toLowerCase().includes('ended') ||
        playerObj.playabilityStatus?.reason?.toLowerCase().includes('berakhir');

      // Validasi: Status player harus OK, konten live aktif, dan bukan berstatus offline/ended
      if (!isPlayerEnded && isStatusOk && (hasLiveStreamability || liveBroadcast?.isLiveNow === true || videoDetails?.isLive === true)) {
        isLive = true;
      } else {
        // Cek apakah video ini adalah siaran Upcoming
        const startTs =
          liveBroadcast?.startTimestamp ||
          (playabilityStatus?.liveStreamability?.liveStreamabilityRenderer?.offlineSlate?.liveStreamOfflineSlateRenderer?.scheduledStartTime
            ? new Date(Number(playabilityStatus.liveStreamability.liveStreamabilityRenderer.offlineSlate.liveStreamOfflineSlateRenderer.scheduledStartTime) * 1000).toISOString()
            : null);

        if (startTs) {
          const schedMs = new Date(startTs).getTime();
          if (schedMs >= nowMs - 15 * 60 * 1000 && schedMs <= maxFutureMs) {
            const upTitle = cleanHtmlEntities(videoDetails?.title || '');
            upcomingStreams.push({
              videoId,
              title: upTitle || 'Kajian Mendatang',
              scheduledStartTime: startTs,
              posterUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
              speakerName: extractSpeakerFromTitle(upTitle, defaultSpeaker || 'Asatidzah'),
            });
          }
        }
      }
    } else if (videoId) {
      // Fallback jika ytInitialPlayerResponse gagal di-parse:
      // Verifikasi presisi langsung via YouTube InnerTube API
      const innerCheck = await verifyVideoLiveStatusInnerTube(videoId);
      if (innerCheck.isLive) {
        isLive = true;
        playerObj = innerCheck.playerDetails;
      } else if (innerCheck.isUpcoming && innerCheck.scheduledStartTime) {
        const schedMs = new Date(innerCheck.scheduledStartTime).getTime();
        if (schedMs >= nowMs - 15 * 60 * 1000 && schedMs <= maxFutureMs) {
          const upTitle = cleanHtmlEntities(innerCheck.title || '');
          upcomingStreams.push({
            videoId,
            title: upTitle || 'Kajian Mendatang',
            scheduledStartTime: innerCheck.scheduledStartTime,
            posterUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
            speakerName: extractSpeakerFromTitle(upTitle, defaultSpeaker || 'Asatidzah'),
          });
        }
      }
    }

    // 2. Fallback tangguh via YouTube Atom RSS Feed + InnerTube API
    // YouTube RSS feed & InnerTube API tidak pernah diblokir captcha di IP server cloud manapun (Vercel/AWS)
    if (channelId) {
      try {
        const rssRes = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
          headers: { 'User-Agent': YOUTUBE_FETCH_HEADERS['User-Agent'] },
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        });
        if (rssRes.ok) {
          const rssText = await rssRes.text();
          // Ambil hingga 5 entry video terbaru untuk memeriksa live & upcoming
          const entryMatches = rssText.match(/<entry>[\s\S]*?<\/entry>/g) || [];
          for (const entryXml of entryMatches.slice(0, 5)) {
            const rssVidMatch = entryXml.match(/<yt:videoId>([a-zA-Z0-9_-]{11})<\/yt:videoId>/);
            const rssTitleMatch = entryXml.match(/<title>([^<]+)<\/title>/);
            const entryTitle = rssTitleMatch ? cleanHtmlEntities(rssTitleMatch[1]) : '';
            const entryVideoId = rssVidMatch ? rssVidMatch[1] : null;

            if (entryVideoId) {
              const innerCheck = await verifyVideoLiveStatusInnerTube(entryVideoId);
              if (innerCheck.isLive && !isLive) {
                videoId = entryVideoId;
                playerObj = innerCheck.playerDetails;
                isLive = true;
                if (!playerObj?.videoDetails?.title && entryTitle) {
                  if (!playerObj) playerObj = {};
                  if (!playerObj.videoDetails) playerObj.videoDetails = {};
                  playerObj.videoDetails.title = entryTitle;
                }
              } else if (innerCheck.isUpcoming && innerCheck.scheduledStartTime) {
                const schedMs = new Date(innerCheck.scheduledStartTime).getTime();
                if (schedMs >= nowMs - 15 * 60 * 1000 && schedMs <= maxFutureMs) {
                  const streamTitle = cleanHtmlEntities(innerCheck.title || entryTitle || '');
                  if (!upcomingStreams.some(u => u.videoId === entryVideoId)) {
                    upcomingStreams.push({
                      videoId: entryVideoId,
                      title: streamTitle || 'Kajian Mendatang',
                      scheduledStartTime: innerCheck.scheduledStartTime,
                      posterUrl: `https://i.ytimg.com/vi/${entryVideoId}/hqdefault.jpg`,
                      streamUrl: `https://www.youtube.com/watch?v=${entryVideoId}`,
                      speakerName: extractSpeakerFromTitle(streamTitle, defaultSpeaker || 'Asatidzah'),
                    });
                  }
                }
              }
            }
          }
        }
      } catch (rssErr) {
        // Fallback RSS error diabaikan agar tidak mengganggu alur utama
      }
    }

    // Urutkan upcoming streams berdasarkan jadwal terdekat
    upcomingStreams.sort(
      (a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime()
    );

    if (!isLive || !videoId) {
      return {
        handle,
        channelId,
        isLive: false,
        videoId: null,
        title: '',
        posterUrl: null,
        streamUrl: null,
        speakerName: defaultSpeaker || 'Asatidzah',
        upcomingStreams,
        endedStreams: [],
      };
    }

    // Ekstraksi Judul
    let title = playerObj?.videoDetails?.title || '';
    if (!title) {
      const titleMatch = html.match(/<meta name="title" content="([^"]+)"/);
      if (titleMatch) {
        title = titleMatch[1];
      } else {
        const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/);
        if (ogTitle) title = ogTitle[1];
        else {
          const pageTitle = html.match(/<title>([^<]+)<\/title>/);
          if (pageTitle) title = pageTitle[1].replace(/\s*-\s*YouTube\s*$/i, '');
        }
      }
    }

    // Bersihkan karakter decode html
    title = cleanHtmlEntities(title);

    const posterUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    const streamUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const speakerName = extractSpeakerFromTitle(title, defaultSpeaker || 'Asatidzah');

    return {
      handle,
      channelId,
      isLive: true,
      videoId,
      title,
      posterUrl,
      streamUrl,
      speakerName,
      upcomingStreams: upcomingStreams.filter((u) => u.videoId !== videoId),
      endedStreams: [],
    };
  } catch (err: any) {
    console.error(`Error checking YouTube Live for ${handle}:`, err);
    return {
      handle,
      channelId: knownChannelId || null,
      isLive: false,
      videoId: null,
      title: '',
      posterUrl: null,
      streamUrl: null,
      speakerName: defaultSpeaker || 'Asatidzah',
      upcomingStreams: [],
      endedStreams: [],
      error: err.message,
    };
  }
}

/**
 * Mengambil daftar channel youtube yang dipantau (Aktif)
 */
export async function fetchActiveYoutubeChannels(): Promise<YoutubeChannel[]> {
  const supabaseServer = createAdminClient();
  const { data, error } = await supabaseServer
    .from('youtube_channels')
    .select('*')
    .eq('is_active', true)
    .order('channel_name', { ascending: true });

  if (error) {
    console.error('Error fetchActiveYoutubeChannels:', error);
    return [];
  }
  return (data as YoutubeChannel[]) || [];
}

/**
 * Mengambil channel yang saat ini statusnya LIVE
 */
export async function fetchLiveYoutubeChannels(): Promise<YoutubeChannel[]> {
  const supabaseServer = createAdminClient();
  const { data, error } = await supabaseServer
    .from('youtube_channels')
    .select('*, study_sessions(*)')
    .eq('is_active', true)
    .eq('is_currently_live', true)
    .order('last_live_at', { ascending: false });

  if (error) {
    console.error('Error fetchLiveYoutubeChannels:', error);
    return [];
  }
  return (data as YoutubeChannel[]) || [];
}

/**
 * Mengambil seluruh channel untuk antarmuka admin
 */
export async function fetchAdminYoutubeChannels(): Promise<YoutubeChannel[]> {
  const supabaseServer = createAdminClient();
  const { data, error } = await supabaseServer
    .from('youtube_channels')
    .select('*')
    .order('channel_name', { ascending: true });

  if (error) {
    console.error('Error fetchAdminYoutubeChannels:', error);
    return [];
  }
  return (data as YoutubeChannel[]) || [];
}

/**
 * Memvalidasi ketersediaan publik rekaman video siaran langsung.
 * Menyaring video yang telah disetel Private (403), Deleted (404), atau tidak dapat diputar.
 */
export async function filterPlayableEndedStreams(streams: EndedStreamItem[]): Promise<EndedStreamItem[]> {
  if (!streams || streams.length === 0) return [];

  // Jalankan validasi konkruen cepat via YouTube oEmbed (ringan, tanpa kuota API)
  const validationResults = await Promise.allSettled(
    streams.map(async (item) => {
      if (!item.videoId) return { item, isPlayable: false };
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${item.videoId}&format=json`,
          {
            headers: { 'User-Agent': YOUTUBE_FETCH_HEADERS['User-Agent'] },
            signal: AbortSignal.timeout(3500),
          }
        );
        // Status 403 = Private / dilarang embed; 404 = Video dihapus; 400 = ID tidak valid
        if (res.status === 403 || res.status === 404 || res.status === 400) {
          return { item, isPlayable: false };
        }
        return { item, isPlayable: res.status === 200 };
      } catch {
        // Toleransi network timeout: tetap pertahankan agar tidak terhapus tidak sengaja
        return { item, isPlayable: true };
      }
    })
  );

  return validationResults
    .filter((r) => r.status === 'fulfilled' && r.value.isPlayable)
    .map((r) => (r as PromiseFulfilledResult<{ item: EndedStreamItem; isPlayable: boolean }>).value.item);
}

/**
 * Sinkronisasi seluruh channel YouTube aktif secara otomatis:
 * - Mendeteksi apakah ada yang live
 * - Membuat row `study_sessions` baru jika siaran live baru dimulai
 * - Menutup/mengarsipkan sesi saat siaran selesai
 * - Berjalan secara batch concurrency untuk mencegah timeout serverless
 */
export async function syncAllYoutubeChannels(): Promise<{
  totalChannels: number;
  liveCount: number;
  upcomingCount: number;
  endedCount: number;
  reports: ChannelSyncReport[];
}> {
  const channels = await fetchActiveYoutubeChannels();
  const reports: ChannelSyncReport[] = [];
  let liveCount = 0;
  let upcomingCount = 0;
  let endedCount = 0;

  const supabaseServer = createAdminClient();

  // Proses channel dalam batch paralel (5 channel sekaligus) agar cepat (< 12 detik) dan stabil
  const BATCH_SIZE = 5;
  for (let i = 0; i < channels.length; i += BATCH_SIZE) {
    const batch = channels.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (channel) => {
        let check: LiveDetectionResult | null = null;

        // 1. Prioritaskan YouTube Data API v3 resmi jika API key tersedia di environment
        const apiKey = process.env.YOUTUBE_API_KEY?.trim();
        if (apiKey) {
          check = await checkChannelLiveViaApi(
            channel.channel_handle,
            apiKey,
            channel.default_speaker_name,
            channel.channel_id
          );
        }

        // 2. Fallback ke pengecekan zero-quota scraping / InnerTube jika API key tidak tersedia / gagal
        if (!check) {
          check = await checkChannelLiveStatus(
            channel.channel_handle,
            channel.default_speaker_name,
            channel.channel_id
          );
        }

        const nowIso = new Date().toISOString();

        // Jika channel_id kanonik baru saja ditemukan dan di DB masih kosong, perbarui ke DB
        if (check.channelId && !channel.channel_id) {
          try {
            await supabaseServer
              .from('youtube_channels')
              .update({ channel_id: check.channelId })
              .eq('id', channel.id);
          } catch (updateIdErr) {
            console.warn(`Gagal memperbarui channel_id untuk ${channel.channel_name}:`, updateIdErr);
          }
        }

        if (check.error) {
          return {
            report: {
              channelId: channel.id,
              channelName: channel.channel_name,
              handle: channel.channel_handle,
              status: 'error' as const,
              message: check.error,
            },
            isLive: false,
          };
        }

        if (check.isLive && check.videoId) {
          // Periksa apakah videoId ini sudah ada di study_sessions
          const { data: existingSessions } = await supabaseServer
            .from('study_sessions')
            .select('id, title, stream_url')
            .eq('stream_url', check.streamUrl)
            .limit(1);

          let sessionId = existingSessions && existingSessions.length > 0 ? existingSessions[0].id : null;

          if (!sessionId) {
            // Buat sesi kajian baru secara otomatis
            const { data: newSession, error: insertError } = await supabaseServer
              .from('study_sessions')
              .insert({
                title: check.title || `Live Streaming ${channel.channel_name}`,
                speaker_name: check.speakerName,
                is_online: true,
                stream_url: check.streamUrl,
                poster_url: check.posterUrl,
                status: 'confirmed',
                audience_type: 'umum',
                start_datetime: nowIso,
                is_recurring: false,
                contributor_name: `${channel.channel_name} (Bot Sync)`,
              })
              .select('id')
              .single();

            if (insertError) {
              console.error(`Failed to create study_session for ${channel.channel_name}:`, insertError);
            } else if (newSession) {
              sessionId = newSession.id;
            }

            const upcomingClean = (check.upcomingStreams || []).filter((u) => u.videoId !== check.videoId);
            const endedClean = (check.endedStreams || []).filter((e) => e.videoId !== check.videoId);
            const mergedEnded = endedClean.length > 0 ? endedClean : (channel.ended_streams || []);

            // Perbarui metadata tabel youtube_channels
            await supabaseServer
              .from('youtube_channels')
              .update({
                is_currently_live: true,
                current_video_id: check.videoId,
                current_video_title: check.title,
                current_session_id: sessionId,
                upcoming_streams: upcomingClean,
                ended_streams: mergedEnded,
                last_live_at: nowIso,
                last_checked_at: nowIso,
                updated_at: nowIso,
              })
              .eq('id', channel.id);

            return {
              report: {
                channelId: channel.id,
                channelName: channel.channel_name,
                handle: channel.channel_handle,
                status: 'live_new' as const,
                videoId: check.videoId,
                title: check.title,
                sessionId,
                upcomingCount: upcomingClean.length,
                endedCount: mergedEnded.length,
              },
              isLive: true,
              upcomingCount: upcomingClean.length,
              endedCount: mergedEnded.length,
            };
          } else {
            const upcomingClean = (check.upcomingStreams || []).filter((u) => u.videoId !== check.videoId);
            const endedClean = (check.endedStreams || []).filter((e) => e.videoId !== check.videoId);
            const mergedEndedRaw = endedClean.length > 0 ? endedClean : (channel.ended_streams || []);
            const mergedEnded = await filterPlayableEndedStreams(mergedEndedRaw);

            // Sesi sudah ada sebelumnya di database
            await supabaseServer
              .from('youtube_channels')
              .update({
                is_currently_live: true,
                current_video_id: check.videoId,
                current_video_title: check.title,
                current_session_id: sessionId,
                upcoming_streams: upcomingClean,
                ended_streams: mergedEnded,
                last_live_at: nowIso,
                last_checked_at: nowIso,
                updated_at: nowIso,
              })
              .eq('id', channel.id);

            return {
              report: {
                channelId: channel.id,
                channelName: channel.channel_name,
                handle: channel.channel_handle,
                status: 'live_existing' as const,
                videoId: check.videoId,
                title: check.title,
                sessionId,
                upcomingCount: upcomingClean.length,
                endedCount: mergedEnded.length,
              },
              isLive: true,
              upcomingCount: upcomingClean.length,
              endedCount: mergedEnded.length,
            };
          }
        } else {
          // Channel sedang OFFLINE
          const upcomings = check.upcomingStreams || [];
          const apiEnded = check.endedStreams || [];

          if (channel.is_currently_live) {
            // Bersihkan row study_sessions buatan bot jika ada agar tidak meninggalkan data menggantung
            if (channel.current_session_id) {
              try {
                await supabaseServer
                  .from('study_sessions')
                  .delete()
                  .eq('id', channel.current_session_id);
              } catch (sessionErr) {
                console.warn(`Gagal membersihkan study_session bot ${channel.current_session_id}:`, sessionErr);
              }
            }

            // Arsipkan siaran yang baru saja berakhir ke ended_streams
            const mergedEndedMap = new Map<string, EndedStreamItem>();
            if (channel.current_video_id) {
              mergedEndedMap.set(channel.current_video_id, {
                videoId: channel.current_video_id,
                title: channel.current_video_title || `Live Rekaman ${channel.channel_name}`,
                endedAt: nowIso,
                startedAt: channel.last_live_at || undefined,
                posterUrl: `https://i.ytimg.com/vi/${channel.current_video_id}/hqdefault.jpg`,
                streamUrl: `https://www.youtube.com/watch?v=${channel.current_video_id}`,
                speakerName: channel.default_speaker_name || 'Asatidzah',
                channelName: channel.channel_name,
              });
            }
            apiEnded.forEach((e) => {
              if (!mergedEndedMap.has(e.videoId)) mergedEndedMap.set(e.videoId, e);
            });
            if (Array.isArray(channel.ended_streams)) {
              channel.ended_streams.forEach((e) => {
                if (e?.videoId && !mergedEndedMap.has(e.videoId)) mergedEndedMap.set(e.videoId, e);
              });
            }
            const candidateEndedStreams = Array.from(mergedEndedMap.values()).slice(0, 8);
            const finalEndedStreams = await filterPlayableEndedStreams(candidateEndedStreams);

            await supabaseServer
              .from('youtube_channels')
              .update({
                is_currently_live: false,
                current_video_id: null,
                current_video_title: null,
                current_session_id: null,
                upcoming_streams: upcomings,
                ended_streams: finalEndedStreams,
                last_checked_at: nowIso,
                updated_at: nowIso,
              })
              .eq('id', channel.id);

            return {
              report: {
                channelId: channel.id,
                channelName: channel.channel_name,
                handle: channel.channel_handle,
                status: 'offline' as const,
                upcomingCount: upcomings.length,
                endedCount: finalEndedStreams.length,
                message: 'Siaran langsung baru saja berakhir.',
              },
              isLive: false,
              upcomingCount: upcomings.length,
              endedCount: finalEndedStreams.length,
            };
          } else {
            // Channel sedang offline dan sebelumnya juga offline
            const mergedEndedMap = new Map<string, EndedStreamItem>();
            apiEnded.forEach((e) => mergedEndedMap.set(e.videoId, e));
            if (Array.isArray(channel.ended_streams)) {
              channel.ended_streams.forEach((e) => {
                if (e?.videoId && !mergedEndedMap.has(e.videoId)) mergedEndedMap.set(e.videoId, e);
              });
            }
            const candidateEndedStreams = Array.from(mergedEndedMap.values()).slice(0, 8);
            const finalEndedStreams = await filterPlayableEndedStreams(candidateEndedStreams);

            await supabaseServer
              .from('youtube_channels')
              .update({
                upcoming_streams: upcomings,
                ended_streams: finalEndedStreams,
                last_checked_at: nowIso,
                updated_at: nowIso,
              })
              .eq('id', channel.id);

            return {
              report: {
                channelId: channel.id,
                channelName: channel.channel_name,
                handle: channel.channel_handle,
                status: 'offline' as const,
                upcomingCount: upcomings.length,
                endedCount: finalEndedStreams.length,
                message: 'Offline (tidak sedang live)',
              },
              isLive: false,
              upcomingCount: upcomings.length,
              endedCount: finalEndedStreams.length,
            };
          }
        }
      })
    );

    for (const res of batchResults) {
      if (res.status === 'fulfilled') {
        reports.push(res.value.report);
        if (res.value.isLive) liveCount++;
        upcomingCount += res.value.upcomingCount || 0;
        endedCount += res.value.endedCount || 0;
      }
    }

    // Delay 150ms antar batch untuk stabilitas koneksi
    if (i + BATCH_SIZE < channels.length) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return {
    totalChannels: channels.length,
    liveCount,
    upcomingCount,
    endedCount,
    reports,
  };
}

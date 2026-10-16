import * as cheerio from 'cheerio';
import { supabase } from '@/lib/supabase';
import { createAdminClient } from '@/utils/supabase/admin';

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
  last_checked_at?: string | null;
  last_live_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveDetectionResult {
  handle: string;
  isLive: boolean;
  videoId: string | null;
  title: string;
  posterUrl: string | null;
  streamUrl: string | null;
  speakerName: string;
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
  message?: string;
}

export interface ResolvedYoutubeChannel {
  handle: string;
  channelName: string;
  defaultSpeakerName: string;
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
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          },
          cache: 'no-store',
        });
        if (res.ok) {
          const html = await res.text();
          const authorMatch =
            html.match(/"channelMetadataRenderer":\s*\{"title":"([^"]+)"/)?.[1] ||
            html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ||
            html.match(/<title>([^<]+)<\/title>/)?.[1]?.replace(/\s*-\s*YouTube\s*$/i, '');
          if (authorMatch && !authorMatch.includes('404')) {
            channelName = authorMatch
              .replace(/&amp;/g, '&')
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
              .trim();
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
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
      cache: 'no-store',
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
      ? authorMatch.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim()
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

  // Pola umum judul siaran dakwah: "... Bersama Ust. Firanda Andirja ..."
  const patterns = [
    /(?:Ust(?:adz)?\.?|Kajian\s+Bersama\s+Ust(?:adz)?\.?|Syaikh|Buya|Habib)\s+([A-Za-z\s,.'\-]+?)(?:\s*(?:\||-|–|—|\(|\)|\[|\]|#|\d{1,2}\s+[A-Za-z]+|\/|$))/i,
    /(?:Pemateri\s*:?\s*)([A-Za-z\s,.'\-]+?)(?:\s*(?:\||-|–|—|\(|\)|\[|\]|#|$))/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate.length >= 3 && candidate.length <= 50) {
        // Lengkapi dengan prefix Ust. jika belum ada
        if (!/^ust/i.test(candidate) && !/^syaikh/i.test(candidate) && !/^buya/i.test(candidate)) {
          return `Ust. ${candidate}`;
        }
        return candidate;
      }
    }
  }

  return defaultSpeaker || 'Asatidzah';
}

/**
 * Pengecekan status Live siaran YouTube via canonical endpoint (0 Quota)
 */
export async function checkChannelLiveStatus(rawHandle: string, defaultSpeaker?: string | null): Promise<LiveDetectionResult> {
  const handle = normalizeHandle(rawHandle);
  const targetUrl = `https://www.youtube.com/${handle}/live`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
      cache: 'no-store',
    });

    const html = await res.text();
    const finalUrl = res.url || '';

    // Cek Video ID dari URL final atau canonical link
    let videoId: string | null = null;
    if (finalUrl.includes('/watch?v=')) {
      const match = finalUrl.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
      if (match) videoId = match[1];
    }

    if (!videoId) {
      const match = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/);
      if (match) videoId = match[1];
    }

    if (!videoId) {
      const vidMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      if (vidMatch) videoId = vidMatch[1];
    }

    // 1. Periksa penanda pasti OFFLINE atau siaran berakhir
    const isOfflineStatus =
      html.includes('LIVE_STREAM_OFFLINE') ||
      html.includes('"isLiveNow":false') ||
      html.includes('This live event has ended') ||
      html.includes('Siaran langsung ini telah berakhir') ||
      html.includes('"status":"ENDED"');

    // 2. Periksa penanda siaran langsung yang aktif saat ini
    const isLiveNow = html.includes('"isLiveNow":true');
    const hasLiveStreamability = html.includes('liveStreamabilityRenderer');
    const hasLiveMarker = html.includes('"isLive":true');

    // Suatu siaran dinyatakan LIVE hanya jika videoId ada, tidak berstatus offline, dan memiliki indikator live aktif
    const isLive = Boolean(
      videoId &&
      !isOfflineStatus &&
      (isLiveNow || (hasLiveMarker && hasLiveStreamability))
    );

    if (!isLive || !videoId) {
      return {
        handle,
        isLive: false,
        videoId: null,
        title: '',
        posterUrl: null,
        streamUrl: null,
        speakerName: defaultSpeaker || 'Asatidzah',
      };
    }

    // Ekstraksi Judul
    let title = '';
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

    // Bersihkan karakter decode html
    title = title
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

    const posterUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    const streamUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const speakerName = extractSpeakerFromTitle(title, defaultSpeaker || 'Asatidzah');

    return {
      handle,
      isLive: true,
      videoId,
      title,
      posterUrl,
      streamUrl,
      speakerName,
    };
  } catch (err: any) {
    console.error(`Error checking YouTube Live for ${handle}:`, err);
    return {
      handle,
      isLive: false,
      videoId: null,
      title: '',
      posterUrl: null,
      streamUrl: null,
      speakerName: defaultSpeaker || 'Asatidzah',
      error: err.message,
    };
  }
}

/**
 * Mengambil daftar channel youtube yang dipantau (Aktif)
 */
export async function fetchActiveYoutubeChannels(): Promise<YoutubeChannel[]> {
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
 * Sinkronisasi seluruh channel YouTube aktif secara otomatis:
 * - Mendeteksi apakah ada yang live
 * - Membuat row `study_sessions` baru jika siaran live baru dimulai
 * - Menutup/mengarsipkan sesi saat siaran selesai
 */
export async function syncAllYoutubeChannels(): Promise<{
  totalChannels: number;
  liveCount: number;
  reports: ChannelSyncReport[];
}> {
  const channels = await fetchActiveYoutubeChannels();
  const reports: ChannelSyncReport[] = [];
  let liveCount = 0;

  const supabaseServer = createAdminClient();

  for (const channel of channels) {
    // Delay 500ms antar channel untuk stabilitas
    await new Promise((r) => setTimeout(r, 500));

    const check = await checkChannelLiveStatus(
      channel.channel_handle,
      channel.default_speaker_name
    );

    const nowIso = new Date().toISOString();

    if (check.error) {
      reports.push({
        channelId: channel.id,
        channelName: channel.channel_name,
        handle: channel.channel_handle,
        status: 'error',
        message: check.error,
      });
      continue;
    }

    if (check.isLive && check.videoId) {
      liveCount++;

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

        reports.push({
          channelId: channel.id,
          channelName: channel.channel_name,
          handle: channel.channel_handle,
          status: 'live_new',
          videoId: check.videoId,
          title: check.title,
          sessionId,
        });
      } else {
        reports.push({
          channelId: channel.id,
          channelName: channel.channel_name,
          handle: channel.channel_handle,
          status: 'live_existing',
          videoId: check.videoId,
          title: check.title,
          sessionId,
        });
      }

      // Perbarui metadata tabel youtube_channels
      await supabaseServer
        .from('youtube_channels')
        .update({
          is_currently_live: true,
          current_video_id: check.videoId,
          current_video_title: check.title,
          current_session_id: sessionId,
          last_live_at: nowIso,
          last_checked_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', channel.id);

    } else {
      // Channel sedang OFFLINE
      // Jika sebelumnya sedang live, kita tandai bahwa siaran telah berakhir
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

        await supabaseServer
          .from('youtube_channels')
          .update({
            is_currently_live: false,
            current_video_id: null,
            current_video_title: null,
            current_session_id: null,
            last_checked_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', channel.id);

        reports.push({
          channelId: channel.id,
          channelName: channel.channel_name,
          handle: channel.channel_handle,
          status: 'offline',
          message: 'Siaran langsung baru saja berakhir.',
        });
      } else {
        // Update waktu pengecekan saja
        await supabaseServer
          .from('youtube_channels')
          .update({
            last_checked_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', channel.id);

        reports.push({
          channelId: channel.id,
          channelName: channel.channel_name,
          handle: channel.channel_handle,
          status: 'offline',
          message: 'Offline (tidak sedang live)',
        });
      }
    }
  }

  return {
    totalChannels: channels.length,
    liveCount,
    reports,
  };
}

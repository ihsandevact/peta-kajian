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
  channelId?: string | null;
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
 * Mengecek status live sebuah video ID secara presisi menggunakan YouTube InnerTube Player API (JSON).
 * Endpoint ini tidak membutuhkan API key, sangat cepat (~200ms), dan tidak pernah dicegat
 * oleh Bot Captcha di datacenter cloud (seperti server Vercel/AWS).
 */
export async function verifyVideoLiveStatusInnerTube(videoId: string): Promise<{
  isLive: boolean;
  title?: string;
  playerDetails?: any;
}> {
  if (!videoId || videoId.length !== 11) return { isLive: false };

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

    if (!res.ok) return { isLive: false };
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

    return {
      isLive,
      title: videoDetails?.title || undefined,
      playerDetails: data,
    };
  } catch {
    return { isLive: false };
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
      }
    } else if (videoId) {
      // Fallback jika ytInitialPlayerResponse gagal di-parse:
      // Verifikasi presisi langsung via YouTube InnerTube API
      const innerCheck = await verifyVideoLiveStatusInnerTube(videoId);
      if (innerCheck.isLive) {
        isLive = true;
        playerObj = innerCheck.playerDetails;
      }
    }

    // 2. Fallback tangguh via YouTube Atom RSS Feed + InnerTube API
    // YouTube RSS feed & InnerTube API tidak pernah diblokir captcha di IP server cloud manapun (Vercel/AWS)
    if (!isLive && channelId) {
      try {
        const rssRes = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
          headers: { 'User-Agent': YOUTUBE_FETCH_HEADERS['User-Agent'] },
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        });
        if (rssRes.ok) {
          const rssText = await rssRes.text();
          // Ambil hingga 3 entry video terbaru untuk memastikan siaran langsung yang baru dimulai tertangkap
          const entryMatches = rssText.match(/<entry>[\s\S]*?<\/entry>/g) || [];
          for (const entryXml of entryMatches.slice(0, 3)) {
            const rssVidMatch = entryXml.match(/<yt:videoId>([a-zA-Z0-9_-]{11})<\/yt:videoId>/);
            const rssTitleMatch = entryXml.match(/<title>([^<]+)<\/title>/);
            const entryTitle = rssTitleMatch ? cleanHtmlEntities(rssTitleMatch[1]) : '';
            const entryVideoId = rssVidMatch ? rssVidMatch[1] : null;

            if (entryVideoId) {
              const innerCheck = await verifyVideoLiveStatusInnerTube(entryVideoId);
              if (innerCheck.isLive) {
                videoId = entryVideoId;
                playerObj = innerCheck.playerDetails;
                isLive = true;
                if (!playerObj?.videoDetails?.title && entryTitle) {
                  if (!playerObj) playerObj = {};
                  if (!playerObj.videoDetails) playerObj.videoDetails = {};
                  playerObj.videoDetails.title = entryTitle;
                }
                break;
              }
            }
          }
        }
      } catch (rssErr) {
        // Fallback RSS error diabaikan agar tidak mengganggu alur utama
      }
    }

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
 * Sinkronisasi seluruh channel YouTube aktif secara otomatis:
 * - Mendeteksi apakah ada yang live
 * - Membuat row `study_sessions` baru jika siaran live baru dimulai
 * - Menutup/mengarsipkan sesi saat siaran selesai
 * - Berjalan secara batch concurrency untuk mencegah timeout serverless
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

  // Proses channel dalam batch paralel (5 channel sekaligus) agar cepat (< 12 detik) dan stabil
  const BATCH_SIZE = 5;
  for (let i = 0; i < channels.length; i += BATCH_SIZE) {
    const batch = channels.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (channel) => {
        const check = await checkChannelLiveStatus(
          channel.channel_handle,
          channel.default_speaker_name,
          channel.channel_id
        );

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

            return {
              report: {
                channelId: channel.id,
                channelName: channel.channel_name,
                handle: channel.channel_handle,
                status: 'live_new' as const,
                videoId: check.videoId,
                title: check.title,
                sessionId,
              },
              isLive: true,
            };
          } else {
            // Sesi sudah ada sebelumnya di database
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

            return {
              report: {
                channelId: channel.id,
                channelName: channel.channel_name,
                handle: channel.channel_handle,
                status: 'live_existing' as const,
                videoId: check.videoId,
                title: check.title,
                sessionId,
              },
              isLive: true,
            };
          }
        } else {
          // Channel sedang OFFLINE
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

            return {
              report: {
                channelId: channel.id,
                channelName: channel.channel_name,
                handle: channel.channel_handle,
                status: 'offline' as const,
                message: 'Siaran langsung baru saja berakhir.',
              },
              isLive: false,
            };
          } else {
            // Update waktu pengecekan saja
            await supabaseServer
              .from('youtube_channels')
              .update({
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
                message: 'Offline (tidak sedang live)',
              },
              isLive: false,
            };
          }
        }
      })
    );

    for (const res of batchResults) {
      if (res.status === 'fulfilled') {
        reports.push(res.value.report);
        if (res.value.isLive) liveCount++;
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
    reports,
  };
}

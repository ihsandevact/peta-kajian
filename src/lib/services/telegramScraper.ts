import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';
import { cleanTelegramUsername } from './telegram';
import { resolveYoutubeChannelInfo } from './youtubeTracker';

export interface RawTelegramMessage {
  text: string;
  poster_url: string | null;
  source_channel: string;
}

export interface ExtractedScraperKajian {
  title: string;
  speaker_name: string;
  book_title?: string | null;
  audience_type: 'umum' | 'ikhwan' | 'akhwat';
  start_datetime: string;
  is_recurring?: boolean;
  recurring_pattern?: string | null;
  venue_name?: string | null;
  is_online: boolean;
  stream_url?: string | null;
  source_channel?: string | null;
  poster_url?: string | null;
}

export interface ChannelScrapeResult {
  success: boolean;
  channelUsername: string;
  foundMessages: number;
  extractedCount: number;
  savedCount: number;
  skippedDuplicatesCount: number;
  skippedPastCount: number;
  registeredChannelsCount: number;
  logs: string[];
  error?: string;
}

const ONLINE_VENUE_PATTERN = /\b(live|streaming|youtube|zoom|online|instagram|daring|channel|tv|broadcast)\b/i;

function isValidHttpUrl(value: unknown): boolean {
  if (!value || typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Menyadap pesan teks dan gambar dari channel publik Telegram (t.me/s/{channel})
 */
export async function scrapeTelegramHtml(
  rawChannelUsername: string,
  maxPosts: number = 5
): Promise<{ messages: RawTelegramMessage[]; logs: string[] }> {
  const channel = cleanTelegramUsername(rawChannelUsername);
  const logs: string[] = [];

  if (!channel) {
    logs.push(`❌ Username Telegram tidak valid: "${rawChannelUsername}"`);
    return { messages: [], logs };
  }

  logs.push(`📡 Menyadap data dari https://t.me/s/${channel}...`);

  try {
    const response = await fetch(`https://t.me/s/${channel}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      logs.push(`⚠️ Telegram merespon status ${response.status} (${response.statusText}).`);
      return { messages: [], logs };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const messages: RawTelegramMessage[] = [];

    $('.tgme_widget_message').each((_, el) => {
      const text = $(el).find('.tgme_widget_message_text').text().trim();
      let posterUrl: string | null = null;
      const photoStyle = $(el).find('.tgme_widget_message_photo_wrap').attr('style');

      if (photoStyle) {
        const urlMatch = photoStyle.match(/url\(['"]?(.*?)['"]?\)/);
        if (urlMatch && urlMatch[1]) {
          posterUrl = urlMatch[1];
        }
      }

      if (text && text.length > 20) {
        messages.push({
          text,
          poster_url: posterUrl,
          source_channel: channel,
        });
      }
    });

    const sliced = messages.slice(-maxPosts);
    logs.push(`📦 Ditemukan ${messages.length} pesan, mengambil ${sliced.length} pesan terbaru.`);
    return { messages: sliced, logs };
  } catch (error: any) {
    logs.push(`❌ Gagal menyadap Telegram (@${channel}): ${error?.message || 'Network error'}`);
    return { messages: [], logs };
  }
}

/**
 * Schema JSON yang diharapkan dari Gemini AI
 */
const responseSchema = {
  type: 'OBJECT',
  properties: {
    kajian_list: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Judul atau tema kajian' },
          speaker_name: { type: 'STRING', description: 'Nama pemateri beserta gelar' },
          book_title: { type: 'STRING', nullable: true, description: 'Nama kitab yang dibahas, null jika tidak ada' },
          audience_type: { type: 'STRING', description: "Satu dari: 'umum', 'ikhwan', atau 'akhwat'" },
          start_datetime: {
            type: 'STRING',
            description: 'Waktu mulai dalam format ISO8601 (YYYY-MM-DDTHH:mm:ssZ). Wajib tanggal yang akan datang atau tanggal rutin berikutnya.',
          },
          is_recurring: {
            type: 'BOOLEAN',
            description: "true jika tertulis kajian rutin berulang (contoh: 'Rutin Setiap Ahad', 'Pekan ke-1 & 3', 'Kajian Rutin Ba'da Subuh'), false jika tematik/sekali jalan.",
          },
          recurring_pattern: {
            type: 'STRING',
            nullable: true,
            description: "Keterangan pola rutin jika is_recurring=true (contoh: 'Setiap Ahad Ba'da Subuh'), null jika bukan kajian rutin.",
          },
          venue_name: {
            type: 'STRING',
            nullable: true,
            description: 'Nama Masjid fisik beserta daerahnya (contoh: Masjid Nurul Iman Blok M). null jika kajian hanya online.',
          },
          is_online: { type: 'BOOLEAN', description: 'true jika kajian disiarkan live (YouTube/Zoom/Instagram/dll).' },
          stream_url: { type: 'STRING', nullable: true, description: 'URL live streaming jika disebutkan, null jika tidak ada.' },
          source_channel: {
            type: 'STRING',
            nullable: true,
            description: 'Username Telegram asal pengumuman (contoh: khalidbasalamahofficial)',
          },
          poster_url: { type: 'STRING', nullable: true, description: 'URL gambar poster (salin kembali URL yang diberikan)' },
        },
        required: ['title', 'speaker_name', 'audience_type', 'start_datetime', 'is_online', 'is_recurring'],
      },
    },
  },
  required: ['kajian_list'],
};

/**
 * Ekstraksi jadwal kajian dengan Gemini AI
 */
export async function extractKajianWithAI(
  messages: RawTelegramMessage[],
  channelUsername: string
): Promise<{ kajianList: ExtractedScraperKajian[]; logs: string[] }> {
  const logs: string[] = [];

  if (messages.length === 0) {
    logs.push(`ℹ️ Tidak ada pesan untuk dianalisis oleh AI.`);
    return { kajianList: [], logs };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logs.push(`❌ GEMINI_API_KEY belum dikonfigurasi di server environment.`);
    return { kajianList: [], logs };
  }

  const ai = new GoogleGenAI({ apiKey });

  const promptInput = messages
    .map(
      (msg, idx) =>
        `[Pengumuman ${idx + 1} dari @${msg.source_channel}]
Teks: ${msg.text}
URL Poster Asli: ${msg.poster_url || 'Tidak ada poster'}`
    )
    .join('\n\n---\n\n');

  const now = new Date();
  const todayIso = now.toISOString();
  const todayFormatted = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const promptText = `
Anda adalah bot pengekstrak data jadwal kajian sunnah.
Saya akan memberikan kumpulan pengumuman kajian mentah dari channel Telegram: @${channelUsername}.
Tugas Anda adalah memilah teks tersebut, mengabaikan pengumuman yang BUKAN jadwal kajian, lalu mengembalikan data kajian ke format JSON yang valid.
Hari ini adalah: ${todayFormatted} (${todayIso}).

ATURAN PENYARINGAN WAKTU (SANGAT PENTING):
1. HANYA ekstrak kajian yang AKAN DATANG (upcoming) atau KAJIAN RUTIN berulang:
   - Jika kajian bertanggal tematik/sekali jalan (is_recurring=false) dan tanggal pelaksanaannya SUDAH LEWAT/LAMPAU sebelum hari ini (${todayFormatted}), JANGAN DIEKSTRAK (abaikan).
   - Jika kajian bersifat RUTIN/BERKALA (misal: "Setiap Ahad Subuh", "Kajian Rutin Malam Jumat", "Pekan ke-1 & 3", dll), TETAP EKSTRAK dan set is_recurring=true serta isi recurring_pattern.
2. start_datetime: Wajib menyertakan tanggal dan jam yang jelas dalam format ISO8601 (YYYY-MM-DDTHH:mm:ssZ).
   - Untuk kajian rutin, hitung dan gunakan tanggal jadwal terdekat berikutnya (>= hari ini).
3. Salin 'URL Poster Asli' persis seperti yang diberikan ke kolom poster_url. Jika 'Tidak ada poster', isi dengan null.

ATURAN KAJIAN ONLINE & HYBRID:
- Jika kajian disiarkan via YouTube/Zoom/Instagram Live/Facebook Live/channel streaming DAN tidak menyebut masjid/tempat fisik, set is_online=true dan venue_name=null. JANGAN mengisi venue_name dengan nama channel online.
- Jika kajian diadakan di masjid fisik DAN juga disiarkan live, set is_online=true dan isi venue_name dengan nama masjid (hybrid).
- Jika hanya di masjid fisik, set is_online=false.
- Isi stream_url hanya jika URL streaming tertulis jelas di teks. Jangan mengarang URL.

Data Mentah Telegram:
${promptInput}
`;

  logs.push(`🧠 Meminta Gemini AI mengekstrak data dari ${messages.length} pesan...`);

  const modelsToTry = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
  let rawJsonText: string | null = null;
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          temperature: 0.1,
        },
      });

      if (response && response.text) {
        rawJsonText = response.text;
        logs.push(`✨ AI Model (${modelName}) berhasil merespons.`);
        break;
      }
    } catch (err: any) {
      lastError = err;
      logs.push(`⏳ AI Model ${modelName} gagal: ${err?.message || 'Error'}. Mencoba model alternatif...`);
    }
  }

  if (!rawJsonText) {
    logs.push(`❌ Semua model AI gagal mengekstrak data: ${lastError?.message || 'Unknown error'}`);
    return { kajianList: [], logs };
  }

  try {
    const parsed = JSON.parse(rawJsonText);
    const kajianList: ExtractedScraperKajian[] = parsed.kajian_list || [];
    logs.push(`✅ AI berhasil menemukan ${kajianList.length} jadwal kajian potensial.`);
    return { kajianList, logs };
  } catch (err: any) {
    logs.push(`❌ Gagal mem-parsing format JSON dari AI.`);
    return { kajianList: [], logs };
  }
}

/**
 * Geocoding nama masjid menggunakan MapTiler API
 */
export async function geocodeVenue(
  venueName: string
): Promise<{ lat: number; lng: number; full_address: string } | null> {
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY || process.env.MAPTILER_KEY;
  if (!maptilerKey) return null;

  try {
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(venueName)}.json?key=${maptilerKey}&bbox=95.0,-11.0,141.0,6.0&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return {
        lat,
        lng,
        full_address: data.features[0].place_name,
      };
    }
  } catch {
    // Geocoding network error
  }
  return null;
}

/**
 * Alur Lengkap: Scrape Telegram -> Ekstraksi AI -> Geocoding -> Simpan Supabase
 */
export async function processAndSaveChannelKajian({
  channelUsername,
  maxPosts = 5,
  targetStatus = 'pending',
  supabaseClient,
}: {
  channelUsername: string;
  maxPosts?: number;
  targetStatus?: 'confirmed' | 'pending';
  supabaseClient: any;
}): Promise<ChannelScrapeResult> {
  const allLogs: string[] = [];
  const cleanUser = cleanTelegramUsername(channelUsername);

  allLogs.push(`=== 🚀 Mulai Scraping Channel: @${cleanUser} ===`);

  // 1. Scraping HTML Telegram
  const { messages, logs: scrapeLogs } = await scrapeTelegramHtml(cleanUser, maxPosts);
  allLogs.push(...scrapeLogs);

  if (messages.length === 0) {
    allLogs.push(`ℹ️ Tidak ada pesan teks kajian ditemukan pada @${cleanUser}.`);
    return {
      success: true,
      channelUsername: cleanUser,
      foundMessages: 0,
      extractedCount: 0,
      savedCount: 0,
      skippedDuplicatesCount: 0,
      skippedPastCount: 0,
      registeredChannelsCount: 0,
      logs: allLogs,
    };
  }

  // 2. Ekstraksi AI
  const { kajianList, logs: aiLogs } = await extractKajianWithAI(messages, cleanUser);
  allLogs.push(...aiLogs);

  if (kajianList.length === 0) {
    allLogs.push(`ℹ️ Tidak ada jadwal kajian yang diekstrak oleh AI dari pesan yang disadap.`);
    return {
      success: true,
      channelUsername: cleanUser,
      foundMessages: messages.length,
      extractedCount: 0,
      savedCount: 0,
      skippedDuplicatesCount: 0,
      skippedPastCount: 0,
      registeredChannelsCount: 0,
      logs: allLogs,
    };
  }

  // 3. Simpan ke Database
  let savedCount = 0;
  let skippedDuplicatesCount = 0;
  let skippedPastCount = 0;
  let registeredChannelsCount = 0;

  for (const kajian of kajianList) {
    allLogs.push(`👉 Memproses: "${kajian.title}" oleh ${kajian.speaker_name}`);

    // Filter Waktu: Lewati kajian tematik/sekali jalan yang tanggalnya sudah lampau
    const now = new Date();
    // Beri toleransi 4 jam ke belakang untuk kajian hari ini yang sedang berlangsung
    const pastThreshold = new Date(now.getTime() - 4 * 60 * 60 * 1000);

    if (!kajian.is_recurring && kajian.start_datetime) {
      const sessionDate = new Date(kajian.start_datetime);
      if (!isNaN(sessionDate.getTime()) && sessionDate < pastThreshold) {
        skippedPastCount++;
        allLogs.push(
          `   ⏭️ Jadwal kajian sudah lampau (${sessionDate.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}). Dilewati (Skip).`
        );
        continue;
      }
    }

    if (kajian.is_recurring) {
      allLogs.push(`   🔄 Kajian terdeteksi sebagai jadwal RUTIN (${kajian.recurring_pattern || 'Berkala'}).`);
    }

    // Normalisasi venue vs online
    let venueName = (kajian.venue_name || '').trim() || null;
    let isOnline = !!kajian.is_online;

    if (venueName && ONLINE_VENUE_PATTERN.test(venueName)) {
      allLogs.push(`   📺 "${venueName}" terdeteksi sebagai channel siaran daring, diset online murni.`);
      venueName = null;
      isOnline = true;
    }

    const streamUrl = isOnline && isValidHttpUrl(kajian.stream_url) ? kajian.stream_url : null;

    if (!venueName && !isOnline) {
      allLogs.push(`   ⚠️ Lokasi fisik maupun link daring tidak teridentifikasi. Kajian dilewati.`);
      continue;
    }

    // A. Venue Cek & Insert
    let venueId: string | null = null;
    if (venueName) {
      const { data: existingVenue } = await supabaseClient
        .from('venues')
        .select('id, name')
        .ilike('name', `%${venueName}%`)
        .limit(1)
        .maybeSingle();

      if (existingVenue) {
        venueId = existingVenue.id;
        allLogs.push(`   🏠 Masjid sudah terdaftar di database: ${existingVenue.name}`);
      } else {
        const geo = await geocodeVenue(venueName);
        if (!geo) {
          allLogs.push(`   ⚠️ Titik koordinat "${venueName}" tidak ditemukan.`);
        } else {
          venueId = crypto.randomUUID();
          const { error: venueError } = await supabaseClient.from('venues').insert({
            id: venueId,
            name: venueName,
            address: geo.full_address,
            location: `POINT(${geo.lng} ${geo.lat})`,
            facilities: {},
          });

          if (venueError) {
            allLogs.push(`   ❌ Gagal mendaftarkan masjid baru: ${venueError.message}`);
          } else {
            allLogs.push(`   🏠 Masjid BARU terdaftar: ${venueName} (${geo.full_address})`);
          }
        }
      }
    } else {
      allLogs.push(`   📺 Kajian daring/online (tanpa lokasi fisik masjid).`);
    }

    // JIKA TIDAK MEMILIKI VENUE ID (Masjid fisik tidak ditemukan / online murni):
    if (!venueId) {
      if (streamUrl) {
        allLogs.push(`   🔍 Memeriksa link live streaming: ${streamUrl}`);
        const ytInfo = await resolveYoutubeChannelInfo(streamUrl, kajian.speaker_name);
        if (ytInfo) {
          const { data: existingChannel } = await supabaseClient
            .from('youtube_channels')
            .select('id, channel_name, channel_handle')
            .ilike('channel_handle', ytInfo.handle)
            .maybeSingle();

          if (existingChannel) {
            allLogs.push(
              `   📺 Channel YouTube "${existingChannel.channel_name}" (${existingChannel.channel_handle}) sudah terdaftar di YouTube Tracker. Kajian online tanpa peta dilewati.`
            );
          } else {
            const newChanId = crypto.randomUUID();
            const { error: chanErr } = await supabaseClient.from('youtube_channels').insert({
              id: newChanId,
              channel_name: ytInfo.channelName,
              channel_handle: ytInfo.handle,
              default_speaker_name: ytInfo.defaultSpeakerName,
              default_city: 'Nasional',
              is_active: true,
              is_currently_live: false,
            });

            if (chanErr) {
              allLogs.push(`   ❌ Gagal mendaftarkan channel YouTube baru: ${chanErr.message}`);
            } else {
              registeredChannelsCount++;
              allLogs.push(
                `   🎉 Channel YouTube BARU otomatis didaftarkan: "${ytInfo.channelName}" (${ytInfo.handle})!`
              );
            }
          }
        } else {
          allLogs.push(
            `   ℹ️ Link siaran daring bukan YouTube atau tidak dapat di-resolve (${streamUrl}). Kajian dilewati.`
          );
        }
      } else {
        allLogs.push(`   ⚠️ Titik koordinat masjid tidak ditemukan dan tidak ada siaran daring. Kajian dilewati.`);
      }

      // Selalu skip dari study_sessions karena tidak memiliki lokasi fisik di peta
      continue;
    }

    // B. Cek Duplikasi Kajian (hanya untuk kajian berlokasi fisik)
    const { data: existingSession } = await supabaseClient
      .from('study_sessions')
      .select('id')
      .ilike('speaker_name', kajian.speaker_name)
      .eq('start_datetime', kajian.start_datetime)
      .eq('venue_id', venueId)
      .limit(1)
      .maybeSingle();

    if (existingSession) {
      skippedDuplicatesCount++;
      allLogs.push(`   ⏭️ Jadwal kajian sudah ada di database (Duplikat). Dilewati.`);
      continue;
    }

    // C. Insert Study Session Baru (Fisik atau Hybrid)
    const posterUrl = isValidHttpUrl(kajian.poster_url) ? kajian.poster_url : null;
    const { error: sessionError } = await supabaseClient.from('study_sessions').insert({
      venue_id: venueId,
      speaker_name: kajian.speaker_name,
      title: kajian.title,
      book_title: kajian.book_title || null,
      audience_type: kajian.audience_type || 'umum',
      start_datetime: kajian.start_datetime,
      poster_url: posterUrl,
      is_recurring: !!kajian.is_recurring,
      recurring_pattern: kajian.recurring_pattern || null,
      is_online: isOnline,
      stream_url: streamUrl,
      contributor_name: kajian.source_channel ? `@${kajian.source_channel.replace(/^@/, '')}` : `@${cleanUser}`,
      status: targetStatus, // Default: 'pending' (membutuhkan approval admin)
    });

    if (sessionError) {
      allLogs.push(`   ❌ Gagal menyimpan kajian ke database: ${sessionError.message}`);
    } else {
      savedCount++;
      const statusLabel =
        targetStatus === 'confirmed' ? 'Disetujui Langsung' : 'Menunggu Kurasi Admin (Pending)';
      allLogs.push(`   💾 Kajian BARU berhasil disimpan! (Status: ${statusLabel})`);
    }
  }

  allLogs.push(
    `🏁 Selesai untuk @${cleanUser}: Disimpan = ${savedCount}, Channel YouTube Baru = ${registeredChannelsCount}, Duplikat = ${skippedDuplicatesCount}, Lampau = ${skippedPastCount}, Total Pesan = ${messages.length}`
  );

  return {
    success: true,
    channelUsername: cleanUser,
    foundMessages: messages.length,
    extractedCount: kajianList.length,
    savedCount,
    skippedDuplicatesCount,
    skippedPastCount,
    registeredChannelsCount,
    logs: allLogs,
  };
}

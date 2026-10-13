import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import crypto from 'crypto';
import WebSocket from 'ws';

// 1. Muat environment variables dari .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
  console.error("❌ ERROR: Pastikan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, dan GEMINI_API_KEY ada di .env.local");
  process.exit(1);
}

// Node 20 polyfill for Supabase
global.WebSocket = WebSocket;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

import * as cheerio from 'cheerio';

// Target Channel Telegram Publik (bisa ditambah sebanyak mungkin)
const TELEGRAM_CHANNELS = [
  'kajianjabodetabek',
  'infokajian_id',
  'grupislamsunnah',
  'rumayshocom',
  'dzulqarnainms',
  'khalidbasalamahofficial',
  'adihidayatofficial',
  'hannan_attaki',
  'felixsiauw',
  'ustadzabdulsomad_official'
];

async function scrapeTelegramChannel(channelUsername) {
  console.log(`📡 Menyadap data dari Telegram: t.me/s/${channelUsername}...`);
  try {
    const response = await fetch(`https://t.me/s/${channelUsername}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    const messages = [];

    $('.tgme_widget_message').each((i, el) => {
      let text = $(el).find('.tgme_widget_message_text').text().trim();
      let posterUrl = null;
      const photoStyle = $(el).find('.tgme_widget_message_photo_wrap').attr('style');
      if (photoStyle) {
        const urlMatch = photoStyle.match(/url\(['"]?(.*?)['"]?\)/);
        if (urlMatch && urlMatch[1]) {
          posterUrl = urlMatch[1];
        }
      }

      if (text && text.length > 20) {
        messages.push({ text, poster_url: posterUrl, source_channel: channelUsername });
      }
    });

    return messages.slice(-5); // Ambil 5 pesan terbaru dari tiap channel
  } catch (error) {
    console.error(`❌ Gagal menyadap Telegram (${channelUsername}):`, error.message);
    return [];
  }
}

// Skema JSON yang kita harapkan dari AI
const responseSchema = {
  type: "OBJECT",
  properties: {
    kajian_list: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", description: "Judul atau tema kajian" },
          speaker_name: { type: "STRING", description: "Nama pemateri beserta gelar" },
          book_title: { type: "STRING", description: "Nama kitab yang dibahas, null jika tidak ada" },
          audience_type: { type: "STRING", description: "Satu dari: 'umum', 'ikhwan', atau 'akhwat'" },
          start_datetime: { type: "STRING", description: "Waktu mulai dalam format ISO8601 (YYYY-MM-DDTHH:mm:ssZ). Gunakan tahun ini." },
          venue_name: { type: "STRING", nullable: true, description: "Nama Masjid fisik beserta daerahnya (contoh: Masjid Nurul Iman Blok M). null jika kajian hanya online." },
          is_online: { type: "BOOLEAN", description: "true jika kajian disiarkan live (YouTube/Zoom/Instagram/dll)." },
          stream_url: { type: "STRING", nullable: true, description: "URL live streaming jika disebutkan, null jika tidak ada." },
          poster_url: { type: "STRING", description: "URL gambar poster (salin kembali URL yang diberikan)" }
        },
        required: ["title", "speaker_name", "audience_type", "start_datetime", "is_online"]
      }
    }
  },
  required: ["kajian_list"]
};

// Nama "venue" yang sebenarnya adalah channel online, bukan tempat fisik
const ONLINE_VENUE_PATTERN = /\b(live|streaming|youtube|zoom|online|instagram|daring)\b/i;

function isValidHttpUrl(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

async function geocodeVenue(venueName) {
  if (!MAPTILER_KEY) return null;
  console.log(`🌍 Mencari koordinat untuk: ${venueName}...`);
  try {
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(venueName)}.json?key=${MAPTILER_KEY}&bbox=95.0,-11.0,141.0,6.0&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      console.log(`   📍 Ditemukan: ${lat}, ${lng} (${data.features[0].place_name})`);
      return { lat, lng, full_address: data.features[0].place_name };
    }
  } catch (err) {
    console.error(`   ❌ Gagal geocoding ${venueName}:`, err.message);
  }
  return null;
}

async function runScraper() {
  console.log("🤖 Memulai AI Scraper Bot (Multi-Channel Telegram)...\n");

  let allRawMessages = [];
  
  // Looping untuk menyadap semua channel satu per satu
  for (const channel of TELEGRAM_CHANNELS) {
    const msgs = await scrapeTelegramChannel(channel);
    allRawMessages = allRawMessages.concat(msgs);
    // Beri jeda 1 detik agar tidak dianggap spam oleh Telegram
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  if (allRawMessages.length === 0) {
    console.log("⚠️ Tidak ada pesan kajian yang ditemukan di semua channel tersebut.");
    return;
  }

  console.log(`\n📦 Total terkumpul ${allRawMessages.length} pesan dari ${TELEGRAM_CHANNELS.length} channel.`);

  // Format pesan agar AI mengerti hubungan teks dan posternya
  const promptInput = allRawMessages.map((msg, idx) => 
    `[Pengumuman ${idx + 1} dari @${msg.source_channel}]
    Teks: ${msg.text}
    URL Poster Asli: ${msg.poster_url || "Tidak ada poster"}`
  ).join('\n\n---\n\n');

  const promptText = `
    Anda adalah bot pengekstrak data jadwal kajian sunnah.
    Saya akan memberikan kumpulan pengumuman kajian mentah dari berbagai channel Telegram.
    Tugas Anda adalah memilah teks tersebut, mengabaikan pengumuman yang BUKAN kajian, lalu mengembalikan data kajian ke format JSON yang valid.
    PENTING: Salin 'URL Poster Asli' persis seperti yang diberikan ke kolom poster_url. Jika 'Tidak ada poster', isi dengan null.
    
    ATURAN KAJIAN ONLINE:
    - Jika kajian disiarkan via YouTube/Zoom/Instagram Live/Facebook Live/channel streaming DAN tidak menyebut masjid/tempat fisik,
      set is_online=true dan venue_name=null. JANGAN mengisi venue_name dengan nama channel (contoh salah: "Live Streaming KHB Official").
    - Jika kajian diadakan di masjid fisik DAN juga disiarkan live, set is_online=true dan isi venue_name dengan nama masjid (hybrid).
    - Jika hanya di masjid fisik, set is_online=false.
    - Isi stream_url hanya jika URL streaming tertulis jelas di teks. Jangan mengarang URL.
    
    Data Mentah Telegram:
    ${promptInput}
  `;

  console.log("🧠 Meminta Gemini AI mengekstrak data...");
  let response = null;
  const maxRetries = 3;

  for (let i = 0; i < maxRetries; i++) {
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.1
        }
      });
      break; // Jika sukses, keluar dari loop
    } catch (err) {
      if (err.status === 503 && i < maxRetries - 1) {
        console.log(`   ⏳ Gemini Server sedang sibuk/penuh (503). Mencoba ulang dalam 3 detik... (Percobaan ${i + 2}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.error("❌ Gagal terhubung ke Gemini AI:", err.message);
        return;
      }
    }
  }

  if (!response) return;

  const rawJson = response.text;
  let parsedData;
  try {
    parsedData = JSON.parse(rawJson);
  } catch(e) {
    console.error("❌ Gagal mem-parsing response JSON dari AI.", rawJson);
    return;
  }

  const kajianList = parsedData.kajian_list;
  console.log(`✅ AI berhasil mengekstrak ${kajianList.length} kajian.\n`);

  // Proses satu-persatu untuk Geocoding & Insert
  for (const kajian of kajianList) {
    console.log(`⚙️  Memproses: ${kajian.title} (${kajian.speaker_name})`);
    
    // 0. Normalisasi: jaring pengaman jika AI tetap mengisi nama channel sebagai venue
    let venueName = (kajian.venue_name || '').trim() || null;
    let isOnline = !!kajian.is_online;
    if (venueName && ONLINE_VENUE_PATTERN.test(venueName)) {
      console.log(`   📺 "${venueName}" terdeteksi sebagai channel online, bukan masjid.`);
      venueName = null;
      isOnline = true;
    }
    const streamUrl = isOnline && isValidHttpUrl(kajian.stream_url) ? kajian.stream_url : null;

    if (!venueName && !isOnline) {
      console.log(`   ⚠️  Tidak ada lokasi fisik maupun info online. Dilewati.`);
      console.log("------------------------------------------");
      continue;
    }

    // 1. Cek & Insert Venue (hanya untuk kajian offline / hybrid)
    let venueId = null;
    if (venueName) {
      const { data: existingVenue } = await supabase
        .from('venues')
        .select('id, name')
        .ilike('name', `%${venueName}%`)
        .limit(1)
        .maybeSingle();

      if (existingVenue) {
        venueId = existingVenue.id;
        console.log(`   🏠 Masjid sudah terdaftar: ${existingVenue.name}`);
      } else {
        const geo = await geocodeVenue(venueName);
        if (!geo) {
          // Jangan pakai koordinat default: lebih baik dilewati daripada muncul pin palsu
          if (!isOnline) {
            console.log(`   ⚠️  Koordinat "${venueName}" tidak ditemukan. Kajian dilewati agar tidak muncul pin palsu.`);
            console.log("------------------------------------------");
            continue;
          }
          console.log(`   ⚠️  Koordinat "${venueName}" tidak ditemukan. Disimpan sebagai kajian online saja.`);
        } else {
          venueId = crypto.randomUUID();
          const { error: venueError } = await supabase
            .from('venues')
            .insert({
              id: venueId,
              name: venueName,
              address: geo.full_address,
              location: `POINT(${geo.lng} ${geo.lat})`,
              facilities: {}
            });

          if (venueError) {
            console.error("   ❌ Gagal insert venue:", venueError.message);
            continue;
          }
          console.log(`   🏠 Masjid BARU ditambahkan: ${venueName}`);
        }
      }
    } else {
      console.log(`   📺 Kajian online (tanpa lokasi fisik).`);
    }

    // 2. Cek Duplikasi Kajian
    let dupQuery = supabase
      .from('study_sessions')
      .select('id')
      .ilike('speaker_name', kajian.speaker_name)
      .eq('start_datetime', kajian.start_datetime);
    dupQuery = venueId ? dupQuery.eq('venue_id', venueId) : dupQuery.is('venue_id', null);
    const { data: existingSession } = await dupQuery.limit(1).maybeSingle();

    if (existingSession) {
      console.log(`   ⏭️  Kajian sudah ada di jadwal (Duplikat). Dilewati (Skip).`);
      console.log("------------------------------------------");
      continue;
    }

    // 3. Insert Study Session Baru
    const { error: sessionError } = await supabase
      .from('study_sessions')
      .insert({
        venue_id: venueId,
        speaker_name: kajian.speaker_name,
        title: kajian.title,
        book_title: kajian.book_title,
        audience_type: kajian.audience_type,
        start_datetime: kajian.start_datetime,
        poster_url: kajian.poster_url,
        is_recurring: false,
        is_online: isOnline,
        stream_url: streamUrl,
        status: 'confirmed'
      });

    if (sessionError) {
      console.error("   ❌ Gagal insert kajian:", sessionError.message);
    } else {
      console.log(`   ✅ Kajian BARU berhasil disimpan ke Supabase!`);
    }
    console.log("------------------------------------------");
  }

  console.log("🎉 Proses Scraper Selesai!");
}

runScraper();

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
  'dzulqarnainms'
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
          venue_name: { type: "STRING", description: "Nama Masjid beserta daerahnya (contoh: Masjid Nurul Iman Blok M)" },
          poster_url: { type: "STRING", description: "URL gambar poster (salin kembali URL yang diberikan)" }
        },
        required: ["title", "speaker_name", "audience_type", "start_datetime", "venue_name"]
      }
    }
  },
  required: ["kajian_list"]
};

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
    
    // 1. Cek & Insert Venue
    let venueId;
    const { data: existingVenue } = await supabase
      .from('venues')
      .select('id, name')
      .ilike('name', `%${kajian.venue_name}%`)
      .limit(1)
      .maybeSingle();

    if (existingVenue) {
      venueId = existingVenue.id;
      console.log(`   🏠 Masjid sudah terdaftar: ${existingVenue.name}`);
    } else {
      let lat = -6.2; // Default jakarta
      let lng = 106.8;
      let address = kajian.venue_name;

      const geo = await geocodeVenue(kajian.venue_name);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        address = geo.full_address;
      }

      venueId = crypto.randomUUID();
      const { error: venueError } = await supabase
        .from('venues')
        .insert({
          id: venueId,
          name: kajian.venue_name,
          address: address,
          location: `POINT(${lng} ${lat})`,
          facilities: {}
        });

      if (venueError) {
        console.error("   ❌ Gagal insert venue:", venueError.message);
        continue;
      }
      console.log(`   🏠 Masjid BARU ditambahkan: ${kajian.venue_name}`);
    }

    // 2. Cek Duplikasi Kajian
    const { data: existingSession } = await supabase
      .from('study_sessions')
      .select('id')
      .eq('venue_id', venueId)
      .ilike('speaker_name', kajian.speaker_name)
      .eq('start_datetime', kajian.start_datetime)
      .limit(1)
      .maybeSingle();

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

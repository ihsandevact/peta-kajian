'use server';

import { createClient } from '@/utils/supabase/server';
import { GoogleGenAI } from '@google/genai';

export interface ExtractedKajianData {
  title: string;
  speaker_name: string;
  book_title: string | null;
  start_datetime: string | null; // Format YYYY-MM-DDTHH:mm
  mode: 'offline' | 'online' | 'hybrid';
  venue_name: string | null;
  audience: 'umum' | 'ikhwan' | 'akhwat';
  is_recurring: boolean;
  recurring_rule?: {
    dayOfWeek: number; // 0=Ahad, 1=Senin, ..., 6=Sabtu
    time: string; // HH:mm
    timeCategory: 'subuh' | 'pagi' | 'siang' | 'sore' | 'maghrib' | 'isya';
    weeks: number[]; // [1, 2, 3, 4, 5]
  } | null;
  stream_url: string | null;
  geocodedLocation?: {
    lat: number;
    lng: number;
    place_name: string;
  } | null;
}

const responseSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Judul atau tema kajian yang tertera di poster' },
    speaker_name: { type: 'STRING', description: 'Nama ustadz / pemateri beserta gelarnya' },
    book_title: { type: 'STRING', nullable: true, description: 'Nama kitab yang dibahas jika ada, null jika tematik/tidak ada kitab' },
    start_datetime: {
      type: 'STRING',
      nullable: true,
      description: 'Waktu pelaksanaan kajian dalam format lokal YYYY-MM-DDTHH:mm (contoh: 2026-10-18T09:00). Gunakan tahun ini jika tahun tidak tertulis.',
    },
    mode: {
      type: 'STRING',
      enum: ['offline', 'online', 'hybrid'],
      description: "Pilih: 'offline' jika di masjid/tempat fisik tanpa info streaming; 'online' jika hanya live YouTube/Zoom tanpa masjid; 'hybrid' jika di masjid DAN disiarkan live.",
    },
    venue_name: {
      type: 'STRING',
      nullable: true,
      description: 'Nama Masjid atau tempat fisik beserta kota/daerahnya (contoh: Masjid Nurul Iman Blok M Jakarta). null jika kajian hanya online.',
    },
    audience: {
      type: 'STRING',
      enum: ['umum', 'ikhwan', 'akhwat'],
      description: "Sasaran jamaah: 'umum' (terbuka ikhwan & akhwat), 'ikhwan' (khusus pria), atau 'akhwat' (khusus wanita).",
    },
    is_recurring: {
      type: 'BOOLEAN',
      description: "true jika tertulis kajian rutin (contoh: 'Rutin Setiap Ahad', 'Pekan ke-1 & 3', 'Kajian Rutin Ba'da Subuh'), false jika tematik/sekali jalan.",
    },
    recurring_rule: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        dayOfWeek: { type: 'INTEGER', description: 'Hari: 0 (Ahad), 1 (Senin), 2 (Selasa), 3 (Rabu), 4 (Kamis), 5 (Jumat), 6 (Sabtu)' },
        time: { type: 'STRING', description: 'Jam mulai format HH:mm (contoh: 09:00 atau 18:30)' },
        timeCategory: {
          type: 'STRING',
          enum: ['subuh', 'pagi', 'siang', 'sore', 'maghrib', 'isya'],
          description: "Kategori waktu: 'subuh', 'pagi', 'siang', 'sore', 'maghrib', atau 'isya'",
        },
        weeks: {
          type: 'ARRAY',
          items: { type: 'INTEGER' },
          description: 'Pekan pelaksanaan: [1, 2, 3, 4, 5] untuk setiap pekan, atau pekan tertentu seperti [1, 3] jika pekan ke-1 & ke-3.',
        },
      },
    },
    stream_url: {
      type: 'STRING',
      nullable: true,
      description: 'URL atau link live streaming jika tertulis di poster (contoh: link YouTube, Zoom). null jika tidak ada.',
    },
  },
  required: ['title', 'speaker_name', 'mode', 'audience', 'is_recurring'],
};

export async function extractKajianFromPoster(
  formData: FormData
): Promise<{ success: boolean; data?: ExtractedKajianData; error?: string }> {
  // 1. Verifikasi User Login & Hak Akses Kontributor/Admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Silakan login terlebih dahulu untuk menggunakan fitur AI.' };
  }

  // Verifikasi role kontributor atau admin
  const { ADMIN_EMAILS } = await import('@/lib/services/admin');
  const isAdminByEmail = user.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim());
  let isAuthorized = !!isAdminByEmail;

  if (!isAuthorized) {
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleData && (roleData.role === 'kontributor' || roleData.role === 'admin' || roleData.role === 'superadmin')) {
        isAuthorized = true;
      } else {
        // Cek legacy contributor (pernah membuat session)
        const { count } = await supabase
          .from('study_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('created_by', user.id);
        if (count && count > 0) {
          isAuthorized = true;
        }
      }
    } catch (e) {
      console.warn('Role verification error in extractKajianFromPoster:', e);
    }
  }

  if (!isAuthorized) {
    return {
      success: false,
      error: 'Akses terbatas. Fitur pemindaian poster AI ini hanya dapat diakses oleh Relawan Kontributor Dakwah terverifikasi atau Admin. Silakan ajukan diri menjadi kontributor di profil Anda.',
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'Konfigurasi GEMINI_API_KEY belum tersedia di server. Hubungi administrator.',
    };
  }

  // 2. Ambil berkas poster dari FormData
  const posterFile = formData.get('poster') as File | null;
  if (!posterFile || !(posterFile instanceof File) || posterFile.size === 0) {
    return { success: false, error: 'Silakan pilih berkas gambar/poster kajian terlebih dahulu.' };
  }

  // Batas ukuran 10MB (client compressor biasanya mengompres ke < 1MB)
  if (posterFile.size > 10 * 1024 * 1024) {
    return { success: false, error: 'Ukuran poster maksimal 10 MB.' };
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowedTypes.includes(posterFile.type)) {
    return { success: false, error: 'Format berkas harus berupa gambar (JPG, PNG, atau WEBP).' };
  }

  try {
    // 3. Konversi File ke Base64
    const arrayBuffer = await posterFile.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    const currentYear = new Date().getFullYear();
    const promptText = `
Anda adalah asisten AI cerdas untuk platform jadwal kajian sunnah "Peta Kajian" di Indonesia.
Tugas Anda adalah membaca gambar poster/flyer dakwah ini, lalu mengekstrak semua informasi jadwal kajian secara akurat dan menyusunnya ke dalam format JSON sesuai schema.

Aturan Penting:
1. title: Judul tema atau topik bahasan kajian yang paling menonjol.
2. speaker_name: Nama ustadz / pemateri beserta gelar atau kunyahnya (contoh: "Ustadz Dr. Syafiq Riza Basalamah, M.A.").
3. book_title: Nama kitab rujukan jika disebutkan di poster (contoh: "Kitab Tauhid", "Bulughul Maram"). Jika tidak ada kitab yang dibahas, isi null.
4. start_datetime: Tanggal & jam kajian format YYYY-MM-DDTHH:mm (contoh: "${currentYear}-10-25T09:00"). 
   - Jika tanggal di poster menyertakan kalender Hijriyah dan Masehi, prioritaskan tanggal Masehi.
   - Jika tahun tidak tertulis, gunakan tahun sekarang (${currentYear}).
   - Jika hanya jam tanpa tanggal pasti (kajian rutin), isi null.
   - Perkiraan waktu sholat jika tertulis "Ba'da Subuh" = 05:00, "Ba'da Maghrib" = 18:30, "Ba'da Isya" = 20:00, "Ba'da Ashar" = 16:00, "Pagi" = 09:00.
5. mode:
   - 'offline': Diadakan di masjid / lokasi fisik dan TIDAK mencantumkan link/siaran live streaming.
   - 'online': Kajian murni via Zoom/YouTube/Instagram Live tanpa kehadiran jamaah di masjid fisik.
   - 'hybrid': Diadakan di masjid fisik DAN disiarkan live streaming.
6. venue_name: Nama masjid atau lokasi fisik beserta kelurahan/kecamatan/kota jika ada (contoh: "Masjid Agung Al-Azhar Kebayoran Baru, Jakarta Selatan"). Jika mode murni 'online', isi null.
7. audience: 'umum' (untuk ikhwan & akhwat), 'ikhwan' (khusus pria), atau 'akhwat' (khusus wanita).
8. is_recurring: true jika ini kajian rutin (misalnya "Setiap Ahad Pekan ke-1 & 3", "Kajian Rutin Malam Kamis", "Rutin Ba'da Subuh"), false jika kajian tematik/tabligh akbar sekali jalan.
9. recurring_rule: jika is_recurring = true, isi dayOfWeek (0=Ahad s/d 6=Sabtu), time (HH:mm), timeCategory (subuh|pagi|siang|sore|maghrib|isya), dan weeks ([1,2,3,4,5] atau pekan tertentu).
10. stream_url: Isi hanya jika link URL live streaming (YouTube, Zoom) tertulis jelas. Jangan mengarang URL. Jika tidak ada, isi null.
`;

    const ai = new GoogleGenAI({ apiKey });

    // Model multimodal aktif
    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
    let lastError: any = null;
    let extractedJsonText: string | null = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: posterFile.type,
                    data: base64Data,
                  },
                },
                {
                  text: promptText,
                },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: responseSchema,
            temperature: 0.1,
          },
        });

        if (response && response.text) {
          extractedJsonText = response.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} gagal atau sedang sibuk:`, err?.status || err?.message || err);
        // Jika 503 (server sibuk), beri jeda singkat sebelum mencoba model berikutnya
        if (err?.status === 503) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    }

    if (!extractedJsonText) {
      throw lastError || new Error('Gagal mendapatkan respon dari AI model.');
    }

    const parsedData: ExtractedKajianData = JSON.parse(extractedJsonText);

    // 4. Geocoding otomatis jika ada venue_name fisik
    const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    if (parsedData.venue_name && maptilerKey && parsedData.mode !== 'online') {
      try {
        const geoUrl = `https://api.maptiler.com/geocoding/${encodeURIComponent(parsedData.venue_name)}.json?key=${maptilerKey}&bbox=95.0,-11.0,141.0,6.0&limit=1`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();

        if (geoData.features && geoData.features.length > 0) {
          const [lng, lat] = geoData.features[0].center;
          parsedData.geocodedLocation = {
            lat,
            lng,
            place_name: geoData.features[0].place_name,
          };
        }
      } catch (geoErr) {
        console.warn('Gagal geocoding venue_name:', geoErr);
      }
    }

    return {
      success: true,
      data: parsedData,
    };
  } catch (error: any) {
    console.error('Error in extractKajianFromPoster:', error);
    return {
      success: false,
      error: error.message || 'Terjadi kesalahan saat memproses gambar poster kajian.',
    };
  }
}

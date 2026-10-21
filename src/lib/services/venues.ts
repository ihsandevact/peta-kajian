import { createClient as createBrowserSupabase } from '@/utils/supabase/client';
import { supabase as staticSupabase } from '../supabase';
import { calculateDistance } from '@/utils/distance';
import type { StudySession } from './kajian';

function getSupabase() {
  if (typeof window !== 'undefined') {
    return createBrowserSupabase();
  }
  return staticSupabase;
}

export interface VenueFacilities {
  parking_car?: boolean;
  parking_motor?: boolean;
  akhwat_area?: boolean;
  kids_friendly?: boolean;
  wheelchair_accessible?: boolean;
  air_conditioned?: boolean;
}

export interface MosqueVenue {
  id: string;
  name: string;
  slug?: string | null;
  address: string;
  city?: string | null;
  province?: string | null;
  lat: number;
  lng: number;
  location?: any;
  facilities?: VenueFacilities | null;
  cover_image_url?: string | null;
  contact_wa?: string | null;
  youtube_channel?: string | null;
  is_verified?: boolean;
  is_test?: boolean;
  active_sessions_count?: number;
  distance_km?: number;
  upcoming_sessions?: StudySession[];
  created_at?: string;
  updated_at?: string;
}

export interface FetchMosquesOptions {
  userLocation?: { lat: number; lng: number } | null;
  search?: string;
  city?: string;
  facilities?: string[];
  limit?: number;
  includeNonMosques?: boolean;
  includeTestData?: boolean;
}

const TEST_VENUE_NAME_REGEX = /\b(test|testing|uji\s*coba|dummy)\b/i;

export function isTestVenueRecord(v: { name?: string; is_test?: boolean; facilities?: any }): boolean {
  if (v.is_test === true || v.facilities?.is_test === true) return true;
  if (v.name && TEST_VENUE_NAME_REGEX.test(v.name)) return true;
  return false;
}

/**
 * Daftar alias kata kunci pencarian kota/kabupaten
 */
export const CITY_ALIASES: Record<string, string[]> = {
  jakarta: [
    'jakarta', 'jaksel', 'jaktim', 'jakbar', 'jakpus', 'jakut', 'dki jakarta', 'dki',
    'kebayoran', 'tebet', 'duren sawit', 'cilandak', 'pasar minggu', 'pasar rebo', 'menteng',
    'tanah abang', 'kelapa gading', 'rawamangun', 'senayan', 'matraman', 'mampang', 'pancoran',
    'jagakarsa', 'kalibata', 'setiabudi', 'palmerah', 'grogol', 'kemayoran', 'sunter', 'pluit',
    'fatmawati', 'pondok indah', 'blok m', 'kemang', 'ciganjur', 'pesanggrahan', 'cipayung', 'kalideres', 'cakung'
  ],
  yogyakarta: [
    'yogyakarta', 'jogja', 'jogjakarta', 'diy', 'sleman', 'bantul', 'gunungkidul', 'gunung kidul',
    'kulon progo', 'ngaglik', 'mlati', 'gondomanan', 'kotagede', 'umbulharjo', 'depok sleman',
    'kalasan', 'gamping', 'seyegan', 'berbah', 'playen', 'wates', 'kasihan', 'sewon',
    'banguntapan', 'pogung', 'wonosari', 'karangrejek', 'pleret', 'piyungan', 'pakem'
  ],
  bekasi: [
    'bekasi', 'cikarang', 'tambun', 'pondok gede', 'jatiasih', 'mustika jaya', 'rawabebek',
    'harapan indah', 'pekayon', 'summarecon bekasi', 'cibitung', 'padurenan', 'babelan', 'tarumajaya'
  ],
  depok: [
    'depok', 'cinere', 'sawangan', 'sukmajaya', 'cimanggis', 'beji', 'bojongsari', 'cilodong', 'tapos', 'margonda'
  ],
  tangerang: [
    'tangerang', 'tangsel', 'tangerang selatan', 'bintaro', 'bsd', 'serpong', 'ciputat',
    'pamulang', 'karawaci', 'ciledug', 'curug', 'cikupa', 'alam sutera', 'kelapa dua',
    'pondok aren', 'larangan'
  ],
  bogor: [
    'bogor', 'cileungsi', 'cibinong', 'gunung putri', 'bojonggede', 'sentul', 'ciawi', 'parung', 'jonggol'
  ],
  bandung: [
    'bandung', 'cimahi', 'lembang', 'soreang', 'padalarang', 'buahbatu', 'dago'
  ],
  surabaya: [
    'surabaya', 'sidoarjo', 'gresik', 'rungkut', 'wonokromo', 'gubeng', 'candi'
  ],
  makassar: [
    'makassar', 'gowa', 'maros', 'panakkukang', 'tamalanrea', 'rappocini', 'bontoala', 'tamalate', 'daya'
  ],
  palembang: [
    'palembang', 'ilir', 'ulu', 'sako', 'kemuning', 'sukarami', 'al-jihad'
  ],
  medan: [
    'medan', 'deli serdang', 'binjai', 'belawan'
  ],
  semarang: [
    'semarang', 'tembalang', 'banyumanik', 'ungaran', 'mijen', 'pedurungan', 'ngaliyan'
  ],
  solo: [
    'solo', 'surakarta', 'sukoharjo', 'karanganyar', 'boyolali', 'klaten', 'sragen'
  ],
  tasikmalaya: [
    'tasikmalaya', 'tasik'
  ],
  magelang: [
    'magelang', 'muntilan'
  ],
  malang: [
    'malang', 'batu'
  ]
};

function hasShortWordBoundary(text: string, word: string): boolean {
  const idx = text.indexOf(word);
  if (idx === -1) return false;
  const before = idx === 0 ? ' ' : text[idx - 1];
  const after = idx + word.length >= text.length ? ' ' : text[idx + word.length];
  return !/[a-z0-9]/i.test(before) && !/[a-z0-9]/i.test(after);
}

const PRIORITY_CITIES: { label: string; key: string }[] = [
  { label: 'Jakarta', key: 'jakarta' },
  { label: 'Yogyakarta', key: 'yogyakarta' },
  { label: 'Bekasi', key: 'bekasi' },
  { label: 'Depok', key: 'depok' },
  { label: 'Tangerang', key: 'tangerang' },
  { label: 'Bogor', key: 'bogor' },
  { label: 'Bandung', key: 'bandung' },
  { label: 'Surabaya', key: 'surabaya' },
  { label: 'Makassar', key: 'makassar' },
  { label: 'Palembang', key: 'palembang' },
  { label: 'Medan', key: 'medan' },
  { label: 'Semarang', key: 'semarang' },
  { label: 'Solo', key: 'solo' },
  { label: 'Tasikmalaya', key: 'tasikmalaya' },
  { label: 'Magelang', key: 'magelang' },
  { label: 'Malang', key: 'malang' },
];

/**
 * Mencocokkan apakah suatu masjid berada di kota yang dipilih, dengan memeriksa
 * kolom city, name, dan address menggunakan alias kota / kabupaten sekitarnya.
 */
export function matchCityFilter(
  venue: { name?: string; address?: string; city?: string | null },
  cityFilter: string
): boolean {
  if (!cityFilter || cityFilter.toLowerCase() === 'semua') {
    return true;
  }

  const key = cityFilter.toLowerCase().trim();
  const aliases = CITY_ALIASES[key] || [key];
  const textToSearch = `${venue.city || ''} ${venue.name || ''} ${venue.address || ''}`.toLowerCase();

  return aliases.some((alias) => {
    if (alias.length <= 3) {
      return hasShortWordBoundary(textToSearch, alias);
    }
    return textToSearch.includes(alias);
  });
}

/**
 * Mendeteksi nama kota dari teks nama masjid atau alamat jika kolom city bernilai null
 */
export function detectCityFromVenue(name?: string, address?: string): string | null {
  const combined = `${name || ''} ${address || ''}`.toLowerCase();

  for (const item of PRIORITY_CITIES) {
    const aliases = CITY_ALIASES[item.key] || [item.key];
    const match = aliases.some((alias) => {
      if (alias.length <= 3) {
        return hasShortWordBoundary(combined, alias);
      }
      return combined.includes(alias);
    });
    if (match) {
      return item.label;
    }
  }

  return null;
}

/**
 * Mengambil daftar masjid dari Supabase beserta jumlah kajian aktif dan kalkulasi jarak GPS.
 * Mendukung pengambilan > 1.000 baris secara paralel melewati batas default PostgREST (1.000 baris/request).
 */
export async function fetchAllMosques(options: FetchMosquesOptions = {}): Promise<MosqueVenue[]> {
  const {
    userLocation,
    search,
    city,
    facilities,
    limit = 50000,
    includeNonMosques = false,
    includeTestData = false,
  } = options;

  try {
    const supabaseClient = getSupabase();
    const PAGE_SIZE = 1000;

    // 1. Ambil total baris di `venues` & seluruh `study_sessions` aktif secara paralel
    const [countRes, sessionsRes] = await Promise.all([
      supabaseClient.from('venues').select('id', { count: 'exact', head: true }),
      supabaseClient
        .from('study_sessions')
        .select('id, venue_id, status, title, speaker_name, start_datetime, is_recurring, recurring_pattern, poster_url, is_test')
        .eq('status', 'confirmed'),
    ]);

    let sessionRows: any[] = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
    // Fallback jika kolom is_test belum tersedia di database
    if (sessionsRes.error && sessionsRes.error.message?.includes('is_test')) {
      const fallbackSessions = await supabaseClient
        .from('study_sessions')
        .select('id, venue_id, status, title, speaker_name, start_datetime, is_recurring, recurring_pattern, poster_url')
        .eq('status', 'confirmed');
      sessionRows = Array.isArray(fallbackSessions.data) ? fallbackSessions.data : [];
    }

    const totalAvailable = Math.min(countRes.count ?? PAGE_SIZE, limit);
    const totalPages = Math.max(1, Math.ceil(totalAvailable / PAGE_SIZE));

    // Kelompokkan kajian aktif berdasarkan venue_id (O(1) lookup) & pisahkan sesi testing untuk non-admin
    const sessionsByVenue = new Map<string, StudySession[]>();
    const testSessionCountByVenue = new Map<string, number>();

    for (const s of sessionRows) {
      if (!s.venue_id) continue;
      if (s.is_test === true) {
        testSessionCountByVenue.set(s.venue_id, (testSessionCountByVenue.get(s.venue_id) || 0) + 1);
        if (!includeTestData) {
          // Sembunyikan kajian testing dari non-admin
          continue;
        }
      }
      const list = sessionsByVenue.get(s.venue_id) || [];
      list.push(s as StudySession);
      sessionsByVenue.set(s.venue_id, list);
    }

    // 2. Ambil seluruh halaman `venues` per 1.000 baris secara paralel (batch 8 koneksi sekaligus agar cepat & stabil)
    const pageIndices = Array.from({ length: totalPages }, (_, i) => i);
    const allVenueRows: any[] = [];
    const CONCURRENCY = 8;

    for (let i = 0; i < pageIndices.length; i += CONCURRENCY) {
      const batch = pageIndices.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (pageIdx) => {
          const from = pageIdx * PAGE_SIZE;
          const to = Math.min(from + PAGE_SIZE - 1, limit - 1);
          const { data, error } = await supabaseClient
            .from('venues')
            .select('*')
            .order('name', { ascending: true })
            .range(from, to);

          if (error) {
            console.error(`[fetchAllMosques] Error halaman ${pageIdx + 1}:`, error.message);
            return [];
          }
          return data || [];
        })
      );
      for (const rows of batchResults) {
        allVenueRows.push(...rows);
      }
    }

    // 3. Map data & hitung active sessions
    let mosques: MosqueVenue[] = allVenueRows.map((v: any) => {
      const validSessions: StudySession[] = sessionsByVenue.get(v.id) || [];

      let distance_km: number | undefined;
      if (userLocation && typeof v.lat === 'number' && typeof v.lng === 'number') {
        distance_km = calculateDistance(userLocation.lat, userLocation.lng, v.lat, v.lng);
      }

      // Pastikan slug terisi (fallback slug dari nama jika kolom slug di database belum dibuat)
      const generatedSlug =
        v.slug ||
        (v.name
          ? v.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '')
          : `masjid-${v.id.substring(0, 8)}`);

      const isTestVenue =
        isTestVenueRecord(v) ||
        ((testSessionCountByVenue.get(v.id) || 0) > 0 && validSessions.every((s) => s.is_test === true));

      return {
        id: v.id,
        name: v.name,
        slug: generatedSlug,
        address: v.address || 'Alamat belum dilengkapi',
        city: v.city || detectCityFromVenue(v.name, v.address) || extractCityFromAddress(v.address) || 'Indonesia',
        province: v.province || null,
        lat: Number(v.lat),
        lng: Number(v.lng),
        location: v.location,
        facilities: v.facilities || {},
        cover_image_url: v.cover_image_url || null,
        contact_wa: v.contact_wa || null,
        youtube_channel: v.youtube_channel || null,
        is_verified: v.is_verified ?? true,
        is_test: isTestVenue,
        active_sessions_count: validSessions.length,
        upcoming_sessions: validSessions,
        distance_km: typeof distance_km === 'number' ? Math.round(distance_km * 10) / 10 : undefined,
        created_at: v.created_at,
        updated_at: v.updated_at,
      };
    });

    // Sembunyikan venue/masjid testing untuk pengguna non-admin
    if (!includeTestData) {
      mosques = mosques.filter((m) => !isTestVenueRecord(m));
    }

    // Filter venue non-masjid (kantor, resto, rumah, kafe, gedung aula, lapangan, dll.)
    if (!includeNonMosques) {
      mosques = mosques.filter((m) => isRealMosqueVenue(m.name));
    }

    // Filter kota (jika diberikan via options)
    if (city && city.toLowerCase() !== 'semua') {
      mosques = mosques.filter((m) => matchCityFilter(m, city));
    }

    // Filter teks pencarian (nama, alamat, kota)
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      mosques = mosques.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.address.toLowerCase().includes(q) ||
          (m.city && m.city.toLowerCase().includes(q))
      );
    }

    // Filter fasilitas
    if (facilities && facilities.length > 0) {
      mosques = mosques.filter((m) => {
        if (!m.facilities) return false;
        return facilities.every((fac) => {
          return m.facilities && (m.facilities as any)[fac] === true;
        });
      });
    }

    // Sortir: jika ada userLocation, utamakan dari yang terdekat
    if (userLocation) {
      mosques.sort((a, b) => {
        if (a.distance_km === undefined) return 1;
        if (b.distance_km === undefined) return -1;
        return a.distance_km - b.distance_km;
      });
    }

    return mosques;
  } catch (err) {
    console.error('[fetchAllMosques] Unexpected error:', err);
    return [];
  }
}

/**
 * Mengambil detail 1 masjid berdasarkan slug atau id
 */
export async function fetchMosqueBySlugOrId(
  slugOrId: string,
  options: { includeTestData?: boolean } = {}
): Promise<{ venue: MosqueVenue; sessions: StudySession[] } | null> {
  const { includeTestData = false } = options;
  try {
    const supabaseClient = getSupabase();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

    let query = supabaseClient.from('venues').select('*');

    if (isUuid) {
      query = query.or(`id.eq.${slugOrId},slug.eq.${slugOrId}`);
    } else {
      query = query.eq('slug', slugOrId);
    }

    const { data: venueData, error: venueError } = await query.maybeSingle();

    if (venueError || !venueData) {
      // Fallback jika query slug gagal, coba cari berdasarkan ID jika UUID
      if (!isUuid) {
        // Coba cari like name jika slug belum di-populate di database
        const { data: nameMatch } = await supabaseClient
          .from('venues')
          .select('*')
          .ilike('name', `%${slugOrId.replace(/-/g, ' ')}%`)
          .limit(1)
          .maybeSingle();

        if (nameMatch) {
          if (!includeTestData && isTestVenueRecord(nameMatch)) return null;
          return loadVenueWithSessions(nameMatch, includeTestData);
        }
      }
      return null;
    }

    if (!includeTestData && isTestVenueRecord(venueData)) {
      return null;
    }

    return loadVenueWithSessions(venueData, includeTestData);
  } catch (err) {
    console.error('[fetchMosqueBySlugOrId] Unexpected error:', err);
    return null;
  }
}

async function loadVenueWithSessions(
  v: any,
  includeTestData = false
): Promise<{ venue: MosqueVenue; sessions: StudySession[] }> {
  // Ambil kajian aktif yang diselenggarakan di masjid ini
  const supabaseClient = getSupabase();
  const { data: sessionsData } = await supabaseClient
    .from('study_sessions')
    .select(`
      *,
      venues (*)
    `)
    .eq('venue_id', v.id)
    .eq('status', 'confirmed')
    .order('start_datetime', { ascending: true });

  const allSessions: StudySession[] = (sessionsData as StudySession[]) || [];
  const sessions = includeTestData
    ? allSessions
    : allSessions.filter((s) => !s.is_test);

  const generatedSlug = v.slug || 
    (v.name ? v.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : `masjid-${v.id.substring(0, 8)}`);

  const venue: MosqueVenue = {
    id: v.id,
    name: v.name,
    slug: generatedSlug,
    address: v.address || 'Alamat belum dilengkapi',
    city: v.city || detectCityFromVenue(v.name, v.address) || extractCityFromAddress(v.address) || 'Indonesia',
    province: v.province || null,
    lat: Number(v.lat),
    lng: Number(v.lng),
    location: v.location,
    facilities: v.facilities || {},
    cover_image_url: v.cover_image_url || null,
    contact_wa: v.contact_wa || null,
    youtube_channel: v.youtube_channel || null,
    is_verified: v.is_verified ?? true,
    active_sessions_count: sessions.length,
    upcoming_sessions: sessions,
    created_at: v.created_at,
    updated_at: v.updated_at,
  };

  return { venue, sessions };
}

/**
 * Helper untuk menebak kota dari teks alamat jika kolom city belum diisi
 */
/**
 * Helper untuk mengonversi data masjid (Venue) menjadi objek StudySession tujuan navigasi
 * sehingga dapat langsung menggunakan komponen InAppRoutePanel & LiveNavigationHUD tanpa perubahan breaking
 */
export function createDestinationSession(venue: MosqueVenue | { id: string; name: string; address?: string; lat: number; lng: number; location?: any; facilities?: any }): StudySession {
  return {
    id: `venue-${venue.id}`,
    venue_id: venue.id,
    title: venue.name,
    speaker_name: '',
    audience_type: 'umum',
    is_recurring: false,
    status: 'confirmed',
    venues: {
      id: venue.id,
      name: venue.name,
      address: venue.address || '',
      location: venue.location || null,
      lat: venue.lat,
      lng: venue.lng,
      facilities: venue.facilities || {},
    },
  };
}

/**
 * Helper untuk menebak kota dari teks alamat jika kolom city belum diisi
 */
function extractCityFromAddress(address?: string): string | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  const knownCities = [
    'jakarta selatan', 'jakarta pusat', 'jakarta barat', 'jakarta timur', 'jakarta utara', 'jakarta',
    'bekasi', 'depok', 'bogor', 'tangerang selatan', 'tangerang', 'bandung',
    'surabaya', 'semarang', 'yogyakarta', 'jogja', 'solo', 'surakarta', 'malang',
    'sidoarjo', 'gresik', 'medan', 'makassar', 'palembang', 'pekanbaru', 'denpasar', 'balikpapan', 'samarinda'
  ];

  for (const city of knownCities) {
    if (lower.includes(city)) {
      return city
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }
  return null;
}

/**
 * Memeriksa apakah nama lokasi adalah masjid, mushalla, atau pesantren asli.
 * Menyaring keluar tempat non-masjid seperti restoran, kantor, kafe, gedung pertemuan, lapangan, dan rumah pribadi
 * tanpa membuang masjid dari Overture Maps yang menggunakan nama bahasa Inggris ("... Mosque") atau nama Arab ("Al-Muhajirin", dll).
 */
export function isRealMosqueVenue(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return false;
  const lower = name.toLowerCase().trim();
  if (!lower) return false;

  // Filter teks dummy/placeholder dari ekstraksi poster
  if (lower === 'masjid' || lower.includes('lokasi sesuai maps') || lower === 'lokasi kajian') {
    return false;
  }

  // Kata kunci eksplisit tempat ibadah Islam (termasuk "mosque" bahasa Inggris & tanpa batas kata ketat untuk "@MasjidAgung")
  const hasMosqueKeyword =
    /(masjid|mesjid|mosque|musholla|mushalla|musala|surau|langgar|islamic center|islamic centre|pesantren|ponpes|ma'?had)/i.test(
      lower
    );

  // Pola nama non-masjid yang berasal dari venue kajian umum (kantor, resto, rumah, aula, dll)
  const nonMosquePatterns = [
    /\b(kantor|office)\b/i,
    /\b(rumah|rumil|home)\b/i,
    /\b(gedung|hall|aula)\b(?!\s*masjid)/i,
    /\b(cafe|coffee|resto|restaurant)\b/i,
    /\b(hotel|villa|resort)\b/i,
    /\b(balai|kalurahan|kelurahan|balai desa)\b/i,
    /\b(lapangan|stadion)\b/i,
    /\b(ruko)\b/i,
    /\b(zoom|online|youtube|streaming|instagram|live)\b/i,
    /^jl[n\.]?\s/i, // Nama yang hanya berupa alamat jalan
  ];

  // Jika cocok dengan pola non-masjid dan tidak mengandung kata masjid/mosque, saring keluar
  for (const pat of nonMosquePatterns) {
    if (pat.test(lower) && !hasMosqueKeyword) {
      return false;
    }
  }

  return true;
}



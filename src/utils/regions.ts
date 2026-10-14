import type { StudySession } from '@/lib/services/kajian';
import { calculateDistance } from '@/utils/distance';

export interface CityItem {
  id: string;
  name: string;
  provinceId: string;
  provinceName: string;
  center: [number, number]; // [lng, lat]
  zoom: number;
  aliases: string[];
}

export interface ProvinceGroup {
  id: string;
  name: string;
  center: [number, number]; // [lng, lat]
  zoom: number;
  cities: CityItem[];
}

export interface SelectedRegion {
  type: 'province' | 'city';
  id: string;
  name: string;
  provinceName?: string;
  center: [number, number]; // [lng, lat]
  zoom: number;
}

export const INDONESIA_PROVINCES: ProvinceGroup[] = [
  {
    id: 'dki-jakarta',
    name: 'DKI Jakarta',
    center: [106.8456, -6.2088],
    zoom: 11,
    cities: [
      {
        id: 'jakarta-selatan',
        name: 'Jakarta Selatan',
        provinceId: 'dki-jakarta',
        provinceName: 'DKI Jakarta',
        center: [106.8095, -6.2615],
        zoom: 12.5,
        aliases: ['jaksel', 'kebayoran', 'blok m', 'cilandak', 'tebet', 'mampang', 'pasar minggu', 'jagakarsa', 'pancoran', 'pesanggrahan', 'setiabudi'],
      },
      {
        id: 'jakarta-timur',
        name: 'Jakarta Timur',
        provinceId: 'dki-jakarta',
        provinceName: 'DKI Jakarta',
        center: [106.8837, -6.225],
        zoom: 12.5,
        aliases: ['jaktim', 'duren sawit', 'jatinegara', 'kramat jati', 'pasar rebo', 'ciracas', 'cipayung', 'cakung', 'matraman', 'pulogadung'],
      },
      {
        id: 'jakarta-pusat',
        name: 'Jakarta Pusat',
        provinceId: 'dki-jakarta',
        provinceName: 'DKI Jakarta',
        center: [106.8451, -6.1805],
        zoom: 12.5,
        aliases: ['jakpus', 'menteng', 'tanah abang', 'gambir', 'senen', 'cempaka putih', 'johor baru', 'kemayoran', 'sawah besar'],
      },
      {
        id: 'jakarta-barat',
        name: 'Jakarta Barat',
        provinceId: 'dki-jakarta',
        provinceName: 'DKI Jakarta',
        center: [106.7589, -6.1683],
        zoom: 12.5,
        aliases: ['jakbar', 'kebon jeruk', 'palmerah', 'grogol', 'cengkareng', 'kembangan', 'kalideres', 'tambora', 'taman sari'],
      },
      {
        id: 'jakarta-utara',
        name: 'Jakarta Utara',
        provinceId: 'dki-jakarta',
        provinceName: 'DKI Jakarta',
        center: [106.8926, -6.1384],
        zoom: 12.5,
        aliases: ['jakut', 'kelapa gading', 'tanjung priok', 'koja', 'cilincing', 'pademangan', 'penjaringan'],
      },
    ],
  },
  {
    id: 'jawa-barat',
    name: 'Jawa Barat',
    center: [107.6191, -6.9175],
    zoom: 9.5,
    cities: [
      {
        id: 'kota-bandung',
        name: 'Kota Bandung',
        provinceId: 'jawa-barat',
        provinceName: 'Jawa Barat',
        center: [107.6191, -6.9175],
        zoom: 12.5,
        aliases: ['bandung', 'ujung berung', 'dago', 'buah batu', 'cibiru', 'sukajadi', 'antapani', 'arcamanik'],
      },
      {
        id: 'kab-bandung',
        name: 'Kab. Bandung & Cimahi',
        provinceId: 'jawa-barat',
        provinceName: 'Jawa Barat',
        center: [107.528, -6.872],
        zoom: 11.5,
        aliases: ['cimahi', 'soreang', 'baleendah', 'bojongsoang', 'dayeuhkolot', 'lembang', 'padalarang'],
      },
      {
        id: 'kota-depok',
        name: 'Kota Depok',
        provinceId: 'jawa-barat',
        provinceName: 'Jawa Barat',
        center: [106.8186, -6.4025],
        zoom: 12.5,
        aliases: ['depok', 'margonda', 'cinere', 'sawangan', 'sukmajaya', 'cimanggis', 'beji', 'pancoran mas'],
      },
      {
        id: 'kota-bogor',
        name: 'Kota & Kab. Bogor',
        provinceId: 'jawa-barat',
        provinceName: 'Jawa Barat',
        center: [106.7972, -6.5971],
        zoom: 11.5,
        aliases: ['bogor', 'cibinong', 'cileungsi', 'sentul', 'gunung putri', 'ciawi', 'parung', 'bojonggede'],
      },
      {
        id: 'kota-bekasi',
        name: 'Kota & Kab. Bekasi',
        provinceId: 'jawa-barat',
        provinceName: 'Jawa Barat',
        center: [106.9924, -6.2383],
        zoom: 11.5,
        aliases: ['bekasi', 'cikarang', 'tambun', 'pondok gede', 'jatiasih', 'rawamangun', 'mustika jaya'],
      },
      {
        id: 'cirebon',
        name: 'Cirebon',
        provinceId: 'jawa-barat',
        provinceName: 'Jawa Barat',
        center: [108.557, -6.732],
        zoom: 12,
        aliases: ['cirebon', 'sumber', 'kejaksan'],
      },
    ],
  },
  {
    id: 'banten',
    name: 'Banten',
    center: [106.6319, -6.1783],
    zoom: 10,
    cities: [
      {
        id: 'tangerang-selatan',
        name: 'Tangerang Selatan',
        provinceId: 'banten',
        provinceName: 'Banten',
        center: [106.7084, -6.2888],
        zoom: 12.5,
        aliases: ['tangsel', 'bsd', 'bintaro', 'pamulang', 'ciputat', 'serpong', 'pondok aren', 'setu'],
      },
      {
        id: 'kota-tangerang',
        name: 'Kota & Kab. Tangerang',
        provinceId: 'banten',
        provinceName: 'Banten',
        center: [106.6319, -6.1783],
        zoom: 11.5,
        aliases: ['tangerang', 'karawaci', 'cikokol', 'cipondoh', 'ciledug', 'balaraja', 'tigaraksa'],
      },
      {
        id: 'serang-cilegon',
        name: 'Serang & Cilegon',
        provinceId: 'banten',
        provinceName: 'Banten',
        center: [106.1503, -6.1104],
        zoom: 11.5,
        aliases: ['serang', 'cilegon', 'anyer', 'merak'],
      },
    ],
  },
  {
    id: 'di-yogyakarta',
    name: 'DI Yogyakarta',
    center: [110.3695, -7.7956],
    zoom: 10.5,
    cities: [
      {
        id: 'sleman',
        name: 'Kab. Sleman',
        provinceId: 'di-yogyakarta',
        provinceName: 'DI Yogyakarta',
        center: [110.3705, -7.747],
        zoom: 12.5,
        aliases: ['sleman', 'pogung', 'ugm', 'depok sleman', 'mlati', 'ngaglik', 'kaliurang', 'gamping'],
      },
      {
        id: 'kota-yogyakarta',
        name: 'Kota Yogyakarta',
        provinceId: 'di-yogyakarta',
        provinceName: 'DI Yogyakarta',
        center: [110.3695, -7.7956],
        zoom: 13,
        aliases: ['jogja', 'yogyakarta', 'malioboro', 'kraton', 'gondokusuman', 'kotagede', 'umbulharjo'],
      },
      {
        id: 'gunungkidul',
        name: 'Kab. Gunungkidul',
        provinceId: 'di-yogyakarta',
        provinceName: 'DI Yogyakarta',
        center: [110.6035, -7.9605],
        zoom: 11.5,
        aliases: ['gunungkidul', 'gunung kidul', 'wonosari', 'darush sholihin', 'playen', 'panggang'],
      },
      {
        id: 'bantul',
        name: 'Kab. Bantul',
        provinceId: 'di-yogyakarta',
        provinceName: 'DI Yogyakarta',
        center: [110.3289, -7.8924],
        zoom: 12,
        aliases: ['bantul', 'sewon', 'banguntapan', 'kasihan', 'piyungan', 'imogiri'],
      },
      {
        id: 'kulon-progo',
        name: 'Kab. Kulon Progo',
        provinceId: 'di-yogyakarta',
        provinceName: 'DI Yogyakarta',
        center: [110.1584, -7.8286],
        zoom: 11.5,
        aliases: ['kulon progo', 'wates', 'yia'],
      },
    ],
  },
  {
    id: 'jawa-tengah',
    name: 'Jawa Tengah',
    center: [110.4167, -6.9667],
    zoom: 9.5,
    cities: [
      {
        id: 'semarang',
        name: 'Kota Semarang',
        provinceId: 'jawa-tengah',
        provinceName: 'Jawa Tengah',
        center: [110.4167, -6.9667],
        zoom: 12.5,
        aliases: ['semarang', 'simpang lima', 'tembalang', 'banyumanik', 'ngaliyan', 'candisari'],
      },
      {
        id: 'solo-surakarta',
        name: 'Solo & Surakarta',
        provinceId: 'jawa-tengah',
        provinceName: 'Jawa Tengah',
        center: [110.8243, -7.5755],
        zoom: 12.5,
        aliases: ['solo', 'surakarta', 'sukoharjo', 'karanganyar', 'boyolali', 'kartasura', 'klaten'],
      },
      {
        id: 'banyumas-purwokerto',
        name: 'Purwokerto / Banyumas',
        provinceId: 'jawa-tengah',
        provinceName: 'Jawa Tengah',
        center: [109.2307, -7.4243],
        zoom: 12,
        aliases: ['purwokerto', 'banyumas', 'cilacap', 'purbalingga'],
      },
      {
        id: 'magelang',
        name: 'Magelang',
        provinceId: 'jawa-tengah',
        provinceName: 'Jawa Tengah',
        center: [110.2178, -7.4706],
        zoom: 12,
        aliases: ['magelang', 'muntilan', 'borobudur'],
      },
    ],
  },
  {
    id: 'jawa-timur',
    name: 'Jawa Timur',
    center: [112.7521, -7.2575],
    zoom: 9.5,
    cities: [
      {
        id: 'surabaya',
        name: 'Kota Surabaya',
        provinceId: 'jawa-timur',
        provinceName: 'Jawa Timur',
        center: [112.7521, -7.2575],
        zoom: 12.5,
        aliases: ['surabaya', 'gubeng', 'wonokromo', 'rungkut', 'sukolilo', 'kenjeran', 'tegal sari'],
      },
      {
        id: 'sidoarjo-gresik',
        name: 'Sidoarjo & Gresik',
        provinceId: 'jawa-timur',
        provinceName: 'Jawa Timur',
        center: [112.7183, -7.4478],
        zoom: 11.5,
        aliases: ['sidoarjo', 'gresik', 'waru', 'candi', 'porong', 'driyorejo'],
      },
      {
        id: 'malang-batu',
        name: 'Malang & Batu',
        provinceId: 'jawa-timur',
        provinceName: 'Jawa Timur',
        center: [112.6326, -7.9666],
        zoom: 12,
        aliases: ['malang', 'kota batu', 'lowokwaru', 'klojen', 'sukun', 'blimbing'],
      },
      {
        id: 'kediri-madiun',
        name: 'Kediri & Madiun',
        provinceId: 'jawa-timur',
        provinceName: 'Jawa Timur',
        center: [112.0178, -7.8167],
        zoom: 11.5,
        aliases: ['kediri', 'madiun', 'jombang', 'nganjuk', 'blitar'],
      },
      {
        id: 'jember-banyuwangi',
        name: 'Jember & Banyuwangi',
        provinceId: 'jawa-timur',
        provinceName: 'Jawa Timur',
        center: [113.7029, -8.1724],
        zoom: 11,
        aliases: ['jember', 'banyuwangi', 'lumajang', 'bondowoso', 'situbondo'],
      },
    ],
  },
  {
    id: 'sumatera',
    name: 'Sumatera',
    center: [104.7754, -2.9761],
    zoom: 8,
    cities: [
      {
        id: 'palembang',
        name: 'Kota Palembang',
        provinceId: 'sumatera',
        provinceName: 'Sumatera Selatan',
        center: [104.7566, -2.9909],
        zoom: 12,
        aliases: ['palembang', 'ilir barat', 'ilir timur', 'kertapati', 'seberang ulu', 'sultan mahmud badaruddin'],
      },
      {
        id: 'medan',
        name: 'Kota Medan',
        provinceId: 'sumatera',
        provinceName: 'Sumatera Utara',
        center: [98.6722, 3.5952],
        zoom: 12,
        aliases: ['medan', 'deli serdang', 'binjai', 'belawan'],
      },
      {
        id: 'pekanbaru-riau',
        name: 'Pekanbaru & Batam',
        provinceId: 'sumatera',
        provinceName: 'Riau & Kep. Riau',
        center: [101.4478, 0.5071],
        zoom: 11.5,
        aliases: ['pekanbaru', 'batam', 'tanjung pinang', 'dumai'],
      },
      {
        id: 'padang-lampung',
        name: 'Padang & Lampung',
        provinceId: 'sumatera',
        provinceName: 'Sumatera Barat & Lampung',
        center: [100.3543, -0.9492],
        zoom: 11,
        aliases: ['padang', 'bukittinggi', 'bandar lampung', 'lampung', 'metro'],
      },
    ],
  },
  {
    id: 'luar-jawa-lainnya',
    name: 'Kalimantan, Sulawesi, Bali & NTB',
    center: [119.4327, -5.1477],
    zoom: 7,
    cities: [
      {
        id: 'makassar',
        name: 'Kota Makassar',
        provinceId: 'luar-jawa-lainnya',
        provinceName: 'Sulawesi Selatan',
        center: [119.4327, -5.1477],
        zoom: 12,
        aliases: ['makassar', 'gowa', 'maros', 'panakkukang', 'tamalanrea'],
      },
      {
        id: 'balikpapan-samarinda',
        name: 'Balikpapan & Samarinda',
        provinceId: 'luar-jawa-lainnya',
        provinceName: 'Kalimantan Timur',
        center: [116.8289, -1.2379],
        zoom: 11.5,
        aliases: ['balikpapan', 'samarinda', 'ikn', 'nusantara', 'kaltim'],
      },
      {
        id: 'denpasar-lombok',
        name: 'Denpasar & Lombok',
        provinceId: 'luar-jawa-lainnya',
        provinceName: 'Bali & NTB',
        center: [115.2167, -8.65],
        zoom: 11.5,
        aliases: ['denpasar', 'badung', 'kuta', 'mataram', 'lombok'],
      },
    ],
  },
];

// Flat list seluruh kota
export const ALL_CITIES: CityItem[] = INDONESIA_PROVINCES.flatMap((p) => p.cities);

/**
 * Deteksi kota asal sesi kajian berdasarkan nama masjid, alamat teks, dan koordinat lat/lng
 */
export function detectSessionCity(session: StudySession): CityItem | null {
  if (session.is_online && !session.venues) return null;

  const venueName = (session.venues?.name || '').toLowerCase();
  const address = (session.venues?.address || '').toLowerCase();
  const title = session.title.toLowerCase();
  const combinedText = `${venueName} ${address} ${title}`;

  // 1. Coba pencocokan berbasis teks nama kota atau alias (paling spesifik)
  for (const city of ALL_CITIES) {
    // Cek nama kota langsung
    if (combinedText.includes(city.name.toLowerCase())) {
      return city;
    }
    // Cek alias
    for (const alias of city.aliases) {
      // Gunakan regex boundary bila alias pendek
      if (alias.length <= 4) {
        const regex = new RegExp(`\\b${alias}\\b`, 'i');
        if (regex.test(combinedText)) return city;
      } else if (combinedText.includes(alias.toLowerCase())) {
        return city;
      }
    }
  }

  // 2. Fallback: Cek kedekatan koordinat GPS (radius 30 km dari titik pusat kota)
  if (session.venues?.lat && session.venues?.lng) {
    let closestCity: CityItem | null = null;
    let minDistance = Infinity;

    for (const city of ALL_CITIES) {
      const dist = calculateDistance(session.venues.lat, session.venues.lng, city.center[1], city.center[0]);
      if (dist < 30 && dist < minDistance) {
        minDistance = dist;
        closestCity = city;
      }
    }

    if (closestCity) return closestCity;
  }

  return null;
}

/**
 * Cek apakah sesi kajian sesuai dengan wilayah terpilih
 */
export function sessionMatchesRegion(session: StudySession, selected: SelectedRegion | null): boolean {
  if (!selected) return true;

  // Kajian online murni tetap bisa dilihat jika tidak difilter kota fisik
  const city = detectSessionCity(session);
  if (!city) {
    // Jika kajian online murni tanpa masjid, tampilkan hanya jika 'semua' wilayah
    return false;
  }

  if (selected.type === 'city') {
    return city.id === selected.id;
  }

  if (selected.type === 'province') {
    return city.provinceId === selected.id;
  }

  return true;
}

/**
 * Rekap jumlah kajian aktif per kota & per provinsi
 */
export function countActiveSessionsByRegion(sessions: StudySession[]): {
  cityCounts: Record<string, number>;
  provinceCounts: Record<string, number>;
  activeCities: CityItem[];
} {
  const cityCounts: Record<string, number> = {};
  const provinceCounts: Record<string, number> = {};

  for (const s of sessions) {
    const city = detectSessionCity(s);
    if (city) {
      cityCounts[city.id] = (cityCounts[city.id] || 0) + 1;
      provinceCounts[city.provinceId] = (provinceCounts[city.provinceId] || 0) + 1;
    }
  }

  const activeCities = ALL_CITIES.filter((c) => (cityCounts[c.id] || 0) > 0).sort(
    (a, b) => (cityCounts[b.id] || 0) - (cityCounts[a.id] || 0)
  );

  return { cityCounts, provinceCounts, activeCities };
}

/**
 * Utilitas Kalkulasi Arah Kiblat (Geodesic Great Circle Ka'bah) & Daftar Kota Indonesia
 * Koordinat Ka'bah Masjidil Haram Makkah:
 * Lat: 21.422487° N, Lng: 39.826206° E
 */

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export const KAABA_COORDINATES = {
  lat: 21.422487,
  lng: 39.826206,
};

export interface QiblaResult {
  bearing: number; // 0 - 360° dari Utara sejati
  compassHeadingLabel: string; // misal: "Barat Laut (NW)"
  distanceKm: number; // Jarak garis lurus ke Makkah
}

export interface IndonesianCity {
  id: string;
  name: string;
  province: string;
  lat: number;
  lng: number;
  timezone: 'WIB' | 'WITA' | 'WIT';
}

/**
 * Menghitung derajat arah kiblat dan jarak ke Ka'bah dari koordinat pengamat.
 */
export function calculateQiblaDirection(lat: number, lng: number): QiblaResult {
  const phi1 = lat * DEG_TO_RAD;
  const phi2 = KAABA_COORDINATES.lat * DEG_TO_RAD;
  const deltaLambda = (KAABA_COORDINATES.lng - lng) * DEG_TO_RAD;

  // Rumus Forward Azimuth Spherical Trigonometry
  const y = Math.sin(deltaLambda);
  const x =
    Math.cos(phi1) * Math.tan(phi2) -
    Math.sin(phi1) * Math.cos(deltaLambda);

  let qiblaRad = Math.atan2(y, x);
  let bearing = (qiblaRad * RAD_TO_DEG + 360) % 360;

  // Jarak menggunakan formula Haversine
  const R = 6371; // Jari-jari bumi (km)
  const dLat = (KAABA_COORDINATES.lat - lat) * DEG_TO_RAD;
  const dLon = (KAABA_COORDINATES.lng - lng) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Math.round(R * c);

  // Label mata angin
  let compassHeadingLabel = 'Barat Laut (NW)';
  if (bearing >= 337.5 || bearing < 22.5) compassHeadingLabel = 'Utara (N)';
  else if (bearing >= 22.5 && bearing < 67.5) compassHeadingLabel = 'Timur Laut (NE)';
  else if (bearing >= 67.5 && bearing < 112.5) compassHeadingLabel = 'Timur (E)';
  else if (bearing >= 112.5 && bearing < 157.5) compassHeadingLabel = 'Tenggara (SE)';
  else if (bearing >= 157.5 && bearing < 202.5) compassHeadingLabel = 'Selatan (S)';
  else if (bearing >= 202.5 && bearing < 247.5) compassHeadingLabel = 'Barat Daya (SW)';
  else if (bearing >= 247.5 && bearing < 292.5) compassHeadingLabel = 'Barat (W)';
  else compassHeadingLabel = 'Barat Laut (NW)';

  return {
    bearing: Math.round(bearing * 10) / 10,
    compassHeadingLabel,
    distanceKm,
  };
}

/**
 * Daftar kota-kota besar di Indonesia untuk preset pilihan lokasi offline
 */
export const INDONESIAN_CITIES: IndonesianCity[] = [
  // JABODETABEK & JAWA
  { id: 'jakarta', name: 'DKI Jakarta', province: 'DKI Jakarta', lat: -6.2088, lng: 106.8456, timezone: 'WIB' },
  { id: 'bandung', name: 'Kota Bandung', province: 'Jawa Barat', lat: -6.9175, lng: 107.6191, timezone: 'WIB' },
  { id: 'surabaya', name: 'Kota Surabaya', province: 'Jawa Timur', lat: -7.2575, lng: 112.7521, timezone: 'WIB' },
  { id: 'semarang', name: 'Kota Semarang', province: 'Jawa Tengah', lat: -6.9667, lng: 110.4167, timezone: 'WIB' },
  { id: 'yogyakarta', name: 'DI Yogyakarta', province: 'DI Yogyakarta', lat: -7.7956, lng: 110.3695, timezone: 'WIB' },
  { id: 'bogor', name: 'Kota Bogor', province: 'Jawa Barat', lat: -6.5971, lng: 106.806, timezone: 'WIB' },
  { id: 'depok', name: 'Kota Depok', province: 'Jawa Barat', lat: -6.4025, lng: 106.7942, timezone: 'WIB' },
  { id: 'tangerang', name: 'Kota Tangerang', province: 'Banten', lat: -6.1783, lng: 106.6319, timezone: 'WIB' },
  { id: 'bekasi', name: 'Kota Bekasi', province: 'Jawa Barat', lat: -6.2383, lng: 106.9756, timezone: 'WIB' },
  { id: 'solo', name: 'Surakarta (Solo)', province: 'Jawa Tengah', lat: -7.5755, lng: 110.8243, timezone: 'WIB' },
  { id: 'malang', name: 'Kota Malang', province: 'Jawa Timur', lat: -7.9666, lng: 112.6326, timezone: 'WIB' },
  { id: 'serang', name: 'Kota Serang', province: 'Banten', lat: -6.1104, lng: 106.164, timezone: 'WIB' },
  { id: 'cirebon', name: 'Kota Cirebon', province: 'Jawa Barat', lat: -6.732, lng: 108.5523, timezone: 'WIB' },

  // SUMATERA
  { id: 'medan', name: 'Kota Medan', province: 'Sumatera Utara', lat: 3.5952, lng: 98.6722, timezone: 'WIB' },
  { id: 'aceh', name: 'Banda Aceh', province: 'Aceh', lat: 5.5483, lng: 95.3238, timezone: 'WIB' },
  { id: 'padang', name: 'Kota Padang', province: 'Sumatera Barat', lat: -0.9471, lng: 100.4172, timezone: 'WIB' },
  { id: 'palembang', name: 'Kota Palembang', province: 'Sumatera Selatan', lat: -2.9761, lng: 104.7754, timezone: 'WIB' },
  { id: 'pekanbaru', name: 'Kota Pekanbaru', province: 'Riau', lat: 0.5071, lng: 101.4478, timezone: 'WIB' },
  { id: 'lampung', name: 'Bandar Lampung', province: 'Lampung', lat: -5.45, lng: 105.2667, timezone: 'WIB' },
  { id: 'batam', name: 'Kota Batam', province: 'Kepulauan Riau', lat: 1.1301, lng: 104.0529, timezone: 'WIB' },
  { id: 'jambi', name: 'Kota Jambi', province: 'Jambi', lat: -1.6101, lng: 103.6131, timezone: 'WIB' },
  { id: 'bengkulu', name: 'Kota Bengkulu', province: 'Bengkulu', lat: -3.8004, lng: 102.2655, timezone: 'WIB' },

  // KALIMANTAN
  { id: 'banjarmasin', name: 'Kota Banjarmasin', province: 'Kalimantan Selatan', lat: -3.3194, lng: 114.5908, timezone: 'WITA' },
  { id: 'balikpapan', name: 'Kota Balikpapan', province: 'Kalimantan Timur', lat: -1.2379, lng: 116.8529, timezone: 'WITA' },
  { id: 'samarinda', name: 'Kota Samarinda', province: 'Kalimantan Timur', lat: -0.5016, lng: 117.1537, timezone: 'WITA' },
  { id: 'pontianak', name: 'Kota Pontianak', province: 'Kalimantan Barat', lat: -0.0263, lng: 109.3425, timezone: 'WIB' },
  { id: 'palangkaraya', name: 'Palangka Raya', province: 'Kalimantan Tengah', lat: -2.2161, lng: 113.9167, timezone: 'WIB' },

  // SULAWESI
  { id: 'makassar', name: 'Kota Makassar', province: 'Sulawesi Selatan', lat: -5.1477, lng: 119.4327, timezone: 'WITA' },
  { id: 'manado', name: 'Kota Manado', province: 'Sulawesi Utara', lat: 1.4748, lng: 124.8428, timezone: 'WITA' },
  { id: 'palu', name: 'Kota Palu', province: 'Sulawesi Tengah', lat: -0.9003, lng: 119.878, timezone: 'WITA' },
  { id: 'kendari', name: 'Kota Kendari', province: 'Sulawesi Tenggara', lat: -3.9985, lng: 122.5126, timezone: 'WITA' },

  // BALI & NUSA TENGGARA
  { id: 'denpasar', name: 'Kota Denpasar', province: 'Bali', lat: -8.6705, lng: 115.2126, timezone: 'WITA' },
  { id: 'mataram', name: 'Kota Mataram (Lombok)', province: 'NTB', lat: -8.5833, lng: 116.1167, timezone: 'WITA' },
  { id: 'kupang', name: 'Kota Kupang', province: 'NTT', lat: -10.1772, lng: 123.607, timezone: 'WITA' },

  // MALUKU & PAPUA
  { id: 'ambon', name: 'Kota Ambon', province: 'Maluku', lat: -3.6547, lng: 128.1906, timezone: 'WIT' },
  { id: 'ternate', name: 'Kota Ternate', province: 'Maluku Utara', lat: 0.7906, lng: 127.3822, timezone: 'WIT' },
  { id: 'jayapura', name: 'Kota Jayapura', province: 'Papua', lat: -2.5916, lng: 140.669, timezone: 'WIT' },
  { id: 'sorong', name: 'Kota Sorong', province: 'Papua Barat Daya', lat: -0.8762, lng: 131.2558, timezone: 'WIT' },
];

export const DEFAULT_CITY = INDONESIAN_CITIES[0]; // Jakarta

/**
 * Mencari kota terdekat dari koordinat yang diberikan
 */
export function findClosestCity(lat: number, lng: number): IndonesianCity {
  let closest = DEFAULT_CITY;
  let minDistance = Infinity;

  for (const city of INDONESIAN_CITIES) {
    const dLat = city.lat - lat;
    const dLng = city.lng - lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistance) {
      minDistance = distSq;
      closest = city;
    }
  }

  return closest;
}

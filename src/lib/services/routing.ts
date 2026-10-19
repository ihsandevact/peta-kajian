/**
 * Layanan In-App Routing untuk menghitung jalur jalan raya, jarak, dan estimasi waktu tempuh
 * menggunakan Open Source Routing Machine (OSRM) engine.
 */

export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][]; // Array of [longitude, latitude]
}

export interface RouteStep {
  id: string;
  instruction: string;
  streetName: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: string;
  maneuverModifier?: string;
  location: [number, number]; // [lng, lat]
  iconName: string;
}

export interface RouteResult {
  geometry: RouteGeometry;
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  mode: 'driving' | 'walking';
  steps: RouteStep[];
  summary?: string;
  alternatives?: RouteResult[];
  allRoutes?: RouteResult[];
  routeIndex?: number;
}

/**
 * Menerjemahkan manuver OSRM menjadi teks instruksi Bahasa Indonesia dan nama icon Material Symbols
 */
export function formatManeuver(
  maneuver: { type: string; modifier?: string; location: [number, number] },
  streetName: string,
  index: number,
  totalSteps: number
): { instruction: string; iconName: string } {
  const type = maneuver.type || 'turn';
  const mod = maneuver.modifier || '';
  const street = streetName && streetName.trim() ? `ke ${streetName.trim()}` : '';

  if (index === 0 || type === 'depart') {
    return {
      instruction: street ? `Mulai perjalanan ${street}` : 'Mulai perjalanan ke arah tujuan',
      iconName: 'navigation',
    };
  }

  if (index === totalSteps - 1 || type === 'arrive') {
    return {
      instruction: 'Tiba di lokasi masjid tujuan',
      iconName: 'flag',
    };
  }

  if (type === 'roundabout' || type === 'rotary') {
    return {
      instruction: street ? `Di bundaran, ambil jalan ${street}` : 'Masuki bundaran jalan',
      iconName: 'roundabout_right',
    };
  }

  if (type === 'fork') {
    if (mod.includes('left')) {
      return { instruction: `Di percabangan, ambil kiri ${street}`.trim(), iconName: 'turn_slight_left' };
    }
    return { instruction: `Di percabangan, ambil kanan ${street}`.trim(), iconName: 'turn_slight_right' };
  }

  if (mod === 'uturn') {
    return {
      instruction: street ? `Putar balik ${street}` : 'Putar balik (U-Turn)',
      iconName: 'u_turn_left',
    };
  }

  if (mod === 'sharp left') {
    return { instruction: `Belok tajam ke kiri ${street}`.trim(), iconName: 'turn_sharp_left' };
  }

  if (mod === 'sharp right') {
    return { instruction: `Belok tajam ke kanan ${street}`.trim(), iconName: 'turn_sharp_right' };
  }

  if (mod === 'slight left') {
    return { instruction: `Ambil serong kiri ${street}`.trim(), iconName: 'turn_slight_left' };
  }

  if (mod === 'slight right') {
    return { instruction: `Ambil serong kanan ${street}`.trim(), iconName: 'turn_slight_right' };
  }

  if (mod === 'left') {
    return { instruction: `Belok kiri ${street}`.trim(), iconName: 'turn_left' };
  }

  if (mod === 'right') {
    return { instruction: `Belok kanan ${street}`.trim(), iconName: 'turn_right' };
  }

  if (mod === 'straight' || type === 'new name' || type === 'continue') {
    return {
      instruction: street ? `Lurus terus ${street}` : 'Lurus terus ikuti jalan',
      iconName: 'straight',
    };
  }

  return {
    instruction: street ? `Lanjutkan ${street}` : 'Lanjutkan perjalanan',
    iconName: 'straight',
  };
}

/**
 * Menghitung rute perjalanan dari titik asal (origin) ke titik tujuan (destination)
 * @param origin [longitude, latitude]
 * @param destination [longitude, latitude]
 * @param mode 'driving' | 'walking'
/**
 * Parsing satu objek rute OSRM menjadi RouteResult terstruktur
 */
function parseSingleOsrmRoute(route: any, mode: 'driving' | 'walking'): RouteResult {
  const distanceMeters = Math.round(route.distance || 0);
  let durationSeconds = Math.round(route.duration || 0);

  // Jika moda jalan kaki, hitung berdasarkan kecepatan pejalan kaki normal (~4.8 km/jam atau 1.333 m/s)
  // Server publik OSRM hanya menggunakan satu graf kendaraan (driving) untuk semua profil
  if (mode === 'walking') {
    durationSeconds = Math.max(60, Math.round(distanceMeters / 1.333));
  }

  // Parsing steps dari OSRM
  const rawSteps = (route.legs && route.legs[0]?.steps) || [];
  const steps: RouteStep[] = rawSteps.map((raw: any, index: number) => {
    const maneuver = raw.maneuver || { type: 'turn', location: [0, 0] };
    const streetName = raw.name || '';
    const { instruction, iconName } = formatManeuver(maneuver, streetName, index, rawSteps.length);
    const stepDistance = Math.round(raw.distance || 0);
    const stepDuration =
      mode === 'walking'
        ? Math.max(1, Math.round(stepDistance / 1.333))
        : Math.round(raw.duration || 0);

    return {
      id: `step-${index}`,
      instruction,
      streetName,
      distanceMeters: stepDistance,
      durationSeconds: stepDuration,
      maneuverType: maneuver.type,
      maneuverModifier: maneuver.modifier,
      location: maneuver.location || [0, 0],
      iconName,
    };
  });

  const summary = route.legs?.[0]?.summary || route.summary || '';

  return {
    geometry: route.geometry,
    distanceMeters,
    distanceKm: Number((distanceMeters / 1000).toFixed(1)),
    durationSeconds,
    durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
    mode,
    steps,
    summary: summary ? `via ${summary}` : undefined,
  };
}

/**
 * Mengambil data rute jalan raya (dan rute alternatif jika ada) dari OSRM
 * @param origin [longitude, latitude]
 * @param destination [longitude, latitude]
 * @param mode 'driving' | 'walking'
 */
export async function fetchRoute(
  origin: [number, number],
  destination: [number, number],
  mode: 'driving' | 'walking' = 'driving'
): Promise<RouteResult | null> {
  const profile = mode === 'walking' ? 'foot' : 'driving';
  const coords = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=true&alternatives=true`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      console.warn(`[fetchRoute] HTTP Error ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.warn(`[fetchRoute] OSRM status not OK:`, data.code);
      return null;
    }

    const allRoutes: RouteResult[] = data.routes.map((rawRoute: any) =>
      parseSingleOsrmRoute(rawRoute, mode)
    );

    // Sematkan referensi allRoutes dan routeIndex ke setiap rute dalam grup
    allRoutes.forEach((r, idx) => {
      r.allRoutes = allRoutes;
      r.routeIndex = idx;
      r.alternatives = allRoutes.filter((_, i) => i !== idx);
    });

    return allRoutes[0];
  } catch (err) {
    console.warn(`[fetchRoute] Failed to calculate route:`, err);
    return null;
  }
}

/**
 * Format durasi perjalanan ke teks bahasa Indonesia (contoh: "18 mnt", "1 jam 15 mnt")
 */
export function formatDurationText(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} mnt`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} jam`;
  }
  return `${hours} jam ${remainingMinutes} mnt`;
}

/**
 * Format jarak ke teks bahasa Indonesia (contoh: "850 m", "12.4 km")
 */
export function formatDistanceText(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Menghitung jarak garis lurus (dalam meter) antara dua koordinat GPS menggunakan formula Haversine
 */
export function calculateDirectDistanceMeters(
  coord1: [number, number], // [lng, lat]
  coord2: [number, number]  // [lng, lat]
): number {
  const R = 6371e3; // Radius bumi dalam meter
  const lat1 = (coord1[1] * Math.PI) / 180;
  const lat2 = (coord2[1] * Math.PI) / 180;
  const deltaLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const deltaLng = ((coord2[0] - coord1[0]) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Menghitung jarak tegak lurus terdekat (meter) dari satu titik GPS ke polyline rute jalan.
 * Digunakan untuk mendeteksi off-route (salah belok / menyimpang).
 * @param point [longitude, latitude]
 * @param coordinates Array of [longitude, latitude]
 */
export function calculateMinDistanceToPolyline(
  point: [number, number],
  coordinates: [number, number][]
): number {
  if (!coordinates || coordinates.length === 0) return Infinity;
  if (coordinates.length === 1) {
    return calculateDirectDistanceMeters(point, coordinates[0]);
  }

  const pLng = point[0];
  const pLat = point[1];
  const midLatRad = (pLat * Math.PI) / 180;
  const cosLat = Math.cos(midLatRad);
  const R = 6371e3;

  // Konversi titik P ke proyeksi equirectangular lokal (meter)
  const px = pLng * ((Math.PI / 180) * cosLat * R);
  const py = pLat * ((Math.PI / 180) * R);

  let minDistance = Infinity;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const aLng = coordinates[i][0];
    const aLat = coordinates[i][1];
    const bLng = coordinates[i + 1][0];
    const bLat = coordinates[i + 1][1];

    const ax = aLng * ((Math.PI / 180) * cosLat * R);
    const ay = aLat * ((Math.PI / 180) * R);
    const bx = bLng * ((Math.PI / 180) * cosLat * R);
    const by = bLat * ((Math.PI / 180) * R);

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    let dist: number;
    if (lenSq === 0) {
      dist = Math.hypot(px - ax, py - ay);
    } else {
      // Proyeksi scalar t pada segmen [0, 1]
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
      const projX = ax + t * dx;
      const projY = ay + t * dy;
      dist = Math.hypot(px - projX, py - projY);
    }

    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return Math.round(minDistance);
}

export interface EtaComparisonResult {
  etaTimeFormatted: string;
  diffMinutes: number | null;
  status: 'early' | 'tight' | 'late' | 'ongoing' | 'no_time';
  message: string;
  badgeClass: string;
}

/**
 * Menghitung dan membandingkan estimasi jam tiba (ETA) dengan jadwal mulai kajian
 */
export function calculateEtaComparison(
  durationMinutes: number,
  startDatetime?: string | null
): EtaComparisonResult {
  const now = new Date();
  const etaDate = new Date(now.getTime() + durationMinutes * 60 * 1000);
  const etaTimeFormatted = etaDate.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (!startDatetime) {
    return {
      etaTimeFormatted,
      diffMinutes: null,
      status: 'no_time',
      message: 'Jadwal Rutin / Waktu Fleksibel',
      badgeClass: 'bg-surface-container text-on-surface-variant border-surface-container-high',
    };
  }

  const startTime = new Date(startDatetime);
  if (isNaN(startTime.getTime())) {
    return {
      etaTimeFormatted,
      diffMinutes: null,
      status: 'no_time',
      message: 'Jadwal waktu tidak terdefinisi',
      badgeClass: 'bg-surface-container text-on-surface-variant border-surface-container-high',
    };
  }

  const diffMinutes = Math.round((startTime.getTime() - etaDate.getTime()) / (60 * 1000));

  // Jika waktu sekarang sudah melewati jam mulai kajian
  if (now.getTime() > startTime.getTime() + 10 * 60 * 1000) {
    return {
      etaTimeFormatted,
      diffMinutes,
      status: 'ongoing',
      message: 'Kajian sedang berlangsung',
      badgeClass:
        'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    };
  }

  // Tiba setidaknya 15 menit sebelum kajian dimulai
  if (diffMinutes >= 15) {
    return {
      etaTimeFormatted,
      diffMinutes,
      status: 'early',
      message: `Tiba ${diffMinutes} mnt sebelum kajian (cukup waktu wudhu & sholat)`,
      badgeClass:
        'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
    };
  }

  // Tiba mepet (0 - 14 menit sebelum kajian dimulai)
  if (diffMinutes >= 0) {
    return {
      etaTimeFormatted,
      diffMinutes,
      status: 'tight',
      message: `Estimasi tiba ${diffMinutes} mnt sebelum kajian dimulai`,
      badgeClass:
        'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    };
  }

  // Terlambat setelah kajian dimulai
  return {
    etaTimeFormatted,
    diffMinutes,
    status: 'late',
    message: `Estimasi tiba ${Math.abs(diffMinutes)} mnt setelah kajian dimulai`,
    badgeClass:
      'bg-red-500/15 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700',
  };
}


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
 */
export async function fetchRoute(
  origin: [number, number],
  destination: [number, number],
  mode: 'driving' | 'walking' = 'driving'
): Promise<RouteResult | null> {
  const profile = mode === 'walking' ? 'foot' : 'driving';
  const coords = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=true`;

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

    const route = data.routes[0];
    const distanceMeters = Math.round(route.distance || 0);
    const durationSeconds = Math.round(route.duration || 0);

    // Parsing steps dari OSRM
    const rawSteps = (route.legs && route.legs[0]?.steps) || [];
    const steps: RouteStep[] = rawSteps.map((raw: any, index: number) => {
      const maneuver = raw.maneuver || { type: 'turn', location: [0, 0] };
      const streetName = raw.name || '';
      const { instruction, iconName } = formatManeuver(maneuver, streetName, index, rawSteps.length);

      return {
        id: `step-${index}`,
        instruction,
        streetName,
        distanceMeters: Math.round(raw.distance || 0),
        durationSeconds: Math.round(raw.duration || 0),
        maneuverType: maneuver.type,
        maneuverModifier: maneuver.modifier,
        location: maneuver.location || [0, 0],
        iconName,
      };
    });

    return {
      geometry: route.geometry,
      distanceMeters,
      distanceKm: Number((distanceMeters / 1000).toFixed(1)),
      durationSeconds,
      durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
      mode,
      steps,
    };
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


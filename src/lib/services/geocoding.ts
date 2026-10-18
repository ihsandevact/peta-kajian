const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || 'get_your_own_OpIi9ZULNHzrESv6T2vL';

export interface GeocodingPlace {
  id: string;
  name: string;
  placeName: string;
  lat: number;
  lng: number;
  isMosque?: boolean;
}

export interface ReverseGeocodeResult {
  name?: string;
  displayName: string;
  road?: string;
  suburb?: string;
  city?: string;
}

/**
 * Mencari lokasi tempat / masjid di Indonesia menggunakan OpenStreetMap (Nominatim)
 * dan fallback ke MapTiler Geocoding jika diperlukan.
 */
export async function searchPlaces(
  query: string,
  proximity?: { lat: number; lng: number }
): Promise<GeocodingPlace[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const places: GeocodingPlace[] = [];
  const seenCoords = new Set<string>();

  // 1. Prioritas Utama: OpenStreetMap Nominatim (Sangat akurat untuk masjid/musholla di Indonesia)
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      trimmed
    )}&countrycodes=id&limit=6&addressdetails=1`;

    const nomRes = await fetch(nomUrl, {
      headers: {
        'User-Agent': 'PetaKajianApp/1.0 (info@petakajian.id)',
        Accept: 'application/json',
      },
    });

    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (Array.isArray(nomData)) {
        for (const item of nomData) {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          if (isNaN(lat) || isNaN(lng)) continue;

          const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
          if (seenCoords.has(coordKey)) continue;
          seenCoords.add(coordKey);

          const isMosque =
            item.type === 'place_of_worship' ||
            item.class === 'amenity' ||
            item.name?.toLowerCase().includes('masjid') ||
            item.name?.toLowerCase().includes('musholla') ||
            item.display_name?.toLowerCase().includes('masjid');

          places.push({
            id: `nom-${item.place_id || item.osm_id || Math.random()}`,
            name: item.name || item.display_name.split(',')[0],
            placeName: item.display_name,
            lat,
            lng,
            isMosque,
          });
        }
      }
    }
  } catch (err) {
    console.warn('Nominatim geocoding error:', err);
  }

  // 2. Jika hasil Nominatim kurang dari 3, lengkapi dengan MapTiler Geocoding
  if (places.length < 3 && MAPTILER_KEY) {
    try {
      let mtUrl = `https://api.maptiler.com/geocoding/${encodeURIComponent(
        trimmed
      )}.json?key=${MAPTILER_KEY}&bbox=95.0,-11.0,141.0,6.0&limit=5`;

      if (proximity) {
        mtUrl += `&proximity=${proximity.lng},${proximity.lat}`;
      }

      const mtRes = await fetch(mtUrl);
      if (mtRes.ok) {
        const mtData = await mtRes.json();
        if (mtData.features && Array.isArray(mtData.features)) {
          for (const feat of mtData.features) {
            const [lng, lat] = feat.center;
            const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
            if (seenCoords.has(coordKey)) continue;
            seenCoords.add(coordKey);

            const isMosque =
              feat.text?.toLowerCase().includes('masjid') ||
              feat.place_name?.toLowerCase().includes('masjid') ||
              feat.properties?.category === 'mosque';

            places.push({
              id: `mt-${feat.id || Math.random()}`,
              name: feat.text || feat.place_name?.split(',')[0],
              placeName: feat.place_name,
              lat,
              lng,
              isMosque,
            });
          }
        }
      }
    } catch (err) {
      console.warn('MapTiler geocoding error:', err);
    }
  }

  return places;
}

/**
 * Reverse geocode: Mendapatkan nama tempat / alamat dari koordinat GPS (lat, lng)
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PetaKajianApp/1.0 (info@petakajian.id)',
        Accept: 'application/json',
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.display_name) return null;

    const addr = data.address || {};
    return {
      name: data.name || addr.amenity || addr.building,
      displayName: data.display_name,
      road: addr.road,
      suburb: addr.suburb || addr.village || addr.neighbourhood,
      city: addr.city || addr.town || addr.county || addr.regency,
    };
  } catch (err) {
    console.warn('Reverse geocoding error:', err);
    return null;
  }
}

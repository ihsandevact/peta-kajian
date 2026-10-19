/**
 * Utilitas untuk Menyimpan & Menemukan Lokasi Parkir Kendaraan Pengguna
 */

export interface SavedParkingSpot {
  id: string;
  lat: number;
  lng: number;
  savedAt: string; // ISO String
  venueName?: string;
  vehicleType: 'car' | 'motorcycle' | 'person';
  note?: string;
}

const PARKING_STORAGE_KEY = 'peta-kajian:saved-parking-spot';

/**
 * Mengambil data lokasi parkir yang tersimpan
 */
export function getSavedParkingSpot(): SavedParkingSpot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PARKING_STORAGE_KEY);
    if (!raw) return null;
    const data: SavedParkingSpot = JSON.parse(raw);
    if (typeof data.lat === 'number' && typeof data.lng === 'number') {
      return data;
    }
  } catch (err) {
    console.warn('Gagal membaca saved parking spot:', err);
  }
  return null;
}

/**
 * Menyimpan titik lokasi parkir pengguna saat ini
 */
export function saveParkingSpot(
  coords: { lat: number; lng: number },
  venueName?: string,
  vehicleType: 'car' | 'motorcycle' | 'person' = 'car',
  note?: string
): SavedParkingSpot {
  const spot: SavedParkingSpot = {
    id: `parking-${Date.now()}`,
    lat: coords.lat,
    lng: coords.lng,
    savedAt: new Date().toISOString(),
    venueName,
    vehicleType,
    note,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PARKING_STORAGE_KEY, JSON.stringify(spot));
    } catch (err) {
      console.warn('Gagal menyimpan parking spot ke localStorage:', err);
    }
  }

  return spot;
}

/**
 * Menghapus penanda lokasi parkir
 */
export function clearParkingSpot(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PARKING_STORAGE_KEY);
  } catch (err) {
    console.warn('Gagal menghapus parking spot:', err);
  }
}

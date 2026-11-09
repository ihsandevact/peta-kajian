import { hasPhysicalLocation, type StudySession } from '@/lib/services/kajian';
import { calculateDistance, estimateTravelTime } from '@/utils/distance';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { type SelectedRegion, sessionMatchesRegion } from '@/utils/regions';

export interface EvaluatedStudySession {
  session: StudySession;
  effectiveDate: Date | null;
  formattedSchedule: string;
  isLive: boolean;
  isToday: boolean;
  isPast: boolean;
  isRecurring: boolean;
  hasPhysicalLocation: boolean;
  distanceKm: number | null;
  distanceLabel: string | null;
  travelTimeLabel: string | null;
}

export type KajianTimeFilter =
  | 'semua'
  | 'hari_ini'
  | 'berlangsung'
  | 'terbaru'
  | 'selesai'
  | 'rutin'
  | 'online'
  | 'akhwat'
  | 'tersimpan'
  | 'terdekat'
  | string;

export interface KajianQueryCriteria {
  filter?: {
    region?: SelectedRegion | null;
    searchQuery?: string;
    audience?: string[];
    facilities?: string[];
    time?: KajianTimeFilter;
    bookmarkedIds?: string[] | Set<string>;
    placement?: 'map' | 'online' | 'all';
  };
  sort?: {
    userLocation?: { lat: number; lng: number } | null;
    mode?: 'auto' | 'distance' | 'chronological';
  };
  referenceTime?: Date;
}

/**
 * Format jarak numerik ke label representasi ramah pengguna
 * Contoh: 450 m atau 3.2 km
 */
export function formatDistanceLabel(distanceKm: number | null): string | null {
  if (distanceKm === null || isNaN(distanceKm)) return null;
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Mengevaluasi satu sesi kajian: menghitung waktu efektif, jarak GPS, status live/past,
 * dan label jadwal hanya 1x per sesi untuk mencegah komputasi berulang di komponen UI.
 */
export function evaluateSession(
  session: StudySession,
  userLocation?: { lat: number; lng: number } | null,
  referenceTime: Date = new Date()
): EvaluatedStudySession {
  const info = getEffectiveSessionInfo(session, referenceTime);
  const hasLoc = hasPhysicalLocation(session);
  const isRecurring = Boolean(session.is_recurring);

  let distanceKm: number | null = null;
  let distanceLabel: string | null = null;
  let travelTimeLabel: string | null = null;

  if (
    userLocation &&
    hasLoc &&
    typeof session.venues?.lat === 'number' &&
    typeof session.venues?.lng === 'number'
  ) {
    distanceKm = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      session.venues.lat,
      session.venues.lng
    );
    distanceLabel = formatDistanceLabel(distanceKm);
    const travel = estimateTravelTime(distanceKm);
    travelTimeLabel = travel.label;
  }

  return {
    session,
    effectiveDate: info.effectiveDate,
    formattedSchedule: info.dateLabel,
    isLive: info.isLive,
    isToday: info.isToday,
    isPast: info.isPast,
    isRecurring,
    hasPhysicalLocation: hasLoc,
    distanceKm,
    distanceLabel,
    travelTimeLabel,
  };
}

/**
 * Mesin Pencarian & Pemeringkatan Kajian (Kajian Schedule & Query Engine)
 * Memusatkan seluruh logika filtering multi-kriteria, ekspansi jadwal rutin,
 * kalkulasi jarak, dan pemeringkatan prioritas O(N) di satu modul domain teruji.
 */
export function evaluateAndQuerySessions(
  sessions: StudySession[],
  criteria: KajianQueryCriteria = {}
): EvaluatedStudySession[] {
  const refTime = criteria.referenceTime ?? new Date();
  const filter = criteria.filter ?? {};
  const sort = criteria.sort ?? {};
  const userLocation = sort.userLocation ?? null;
  const placement = filter.placement ?? 'all';
  const timeFilter = filter.time ?? 'semua';
  const sortMode = sort.mode ?? (timeFilter === 'terdekat' ? 'distance' : 'auto');

  const bookmarkedSet: Set<string> =
    filter.bookmarkedIds instanceof Set
      ? filter.bookmarkedIds
      : new Set(filter.bookmarkedIds || []);

  const searchQueryLower = (filter.searchQuery || '').trim().toLowerCase();

  // 1. Evaluasi & Filter Koleksi Sesi
  const matched: EvaluatedStudySession[] = [];

  for (const session of sessions) {
    // 1a. Filter Titik Penempatan (Peta vs Online)
    const hasLoc = hasPhysicalLocation(session);
    if (placement === 'map' && !hasLoc) continue;
    if (placement === 'online' && !session.is_online && !session.stream_url) continue;

    // 1b. Filter Wilayah Hierarkis (Provinsi / Kota)
    if (filter.region && !sessionMatchesRegion(session, filter.region)) {
      continue;
    }

    // 1c. Pencarian Teks (Judul, Pemateri, Masjid, Alamat)
    if (searchQueryLower) {
      const matchTitle = session.title?.toLowerCase().includes(searchQueryLower);
      const matchSpeaker = session.speaker_name?.toLowerCase().includes(searchQueryLower);
      const matchVenue = session.venues?.name?.toLowerCase().includes(searchQueryLower);
      const matchAddress = session.venues?.address?.toLowerCase().includes(searchQueryLower);
      if (!matchTitle && !matchSpeaker && !matchVenue && !matchAddress) {
        continue;
      }
    }

    // 1d. Filter Kategori Jamaah (Umum, Ikhwan, Akhwat)
    if (filter.audience && filter.audience.length > 0) {
      if (!filter.audience.includes(session.audience_type)) {
        continue;
      }
    }

    // 1e. Filter Fasilitas Masjid (Semua fasilitas yang dipilih wajib ada)
    if (filter.facilities && filter.facilities.length > 0) {
      const venFacilities = session.venues?.facilities;
      if (!venFacilities) continue;
      const hasAll = filter.facilities.every(
        (fac) => venFacilities[fac as keyof typeof venFacilities] === true
      );
      if (!hasAll) continue;
    }

    // 1f. Evaluasi Waktu & Jarak
    const evaluated = evaluateSession(session, userLocation, refTime);

    // 1g. Filter Status Waktu / Temporal
    // Smart Filtering: Sembunyikan kajian tematik yang sudah lewat dari feed utama,
    // kecuali pengguna sengaja memilih tab 'selesai' atau tab 'tersimpan'.
    if (
      timeFilter !== 'selesai' &&
      timeFilter !== 'tersimpan' &&
      evaluated.isPast &&
      !evaluated.isRecurring
    ) {
      continue;
    }

    if (timeFilter === 'tersimpan' && !bookmarkedSet.has(session.id)) continue;
    if (
      (timeFilter === 'hari_ini' || timeFilter === 'berlangsung') &&
      !evaluated.isToday &&
      !evaluated.isLive
    ) {
      continue;
    }
    if (timeFilter === 'terbaru' && evaluated.isPast && !evaluated.isRecurring) continue;
    if (timeFilter === 'selesai' && (!evaluated.isPast || evaluated.isRecurring)) continue;
    if (timeFilter === 'rutin' && !evaluated.isRecurring) continue;
    if (timeFilter === 'online' && !session.is_online && !session.stream_url) continue;
    if (timeFilter === 'akhwat' && session.audience_type !== 'akhwat') continue;

    matched.push(evaluated);
  }

  // 2. Pemeringkatan / Sorting Cepat (Schwartzian Transform)
  matched.sort((itemA, itemB) => {
    // Mode Jarak Terdekat (Nearby)
    if (sortMode === 'distance') {
      if (itemA.hasPhysicalLocation && !itemB.hasPhysicalLocation) return -1;
      if (!itemA.hasPhysicalLocation && itemB.hasPhysicalLocation) return 1;
      if (!itemA.hasPhysicalLocation && !itemB.hasPhysicalLocation) return 0;
      return (itemA.distanceKm ?? Infinity) - (itemB.distanceKm ?? Infinity);
    }

    // Mode Kronologis Murni
    if (sortMode === 'chronological') {
      const tA = itemA.effectiveDate ? itemA.effectiveDate.getTime() : null;
      const tB = itemB.effectiveDate ? itemB.effectiveDate.getTime() : null;
      if (tA !== null && tB !== null) return tA - tB;
      if (tA !== null && tB === null) return -1;
      if (tA === null && tB !== null) return 1;
      return 0;
    }

    // Mode 'auto' (Prioritas Pintar)
    // 1. Prioritas Tertinggi: Sedang Berlangsung (Live)
    if (itemA.isLive && !itemB.isLive) return -1;
    if (!itemA.isLive && itemB.isLive) return 1;

    // 2. Upcoming / Future vs Selesai / Past
    const aIsFuture = !itemA.isPast;
    const bIsFuture = !itemB.isPast;
    if (aIsFuture && !bIsFuture) return -1;
    if (!aIsFuture && bIsFuture) return 1;

    // 3. Kronologis Waktu Sesi
    const timeA = itemA.effectiveDate ? itemA.effectiveDate.getTime() : null;
    const timeB = itemB.effectiveDate ? itemB.effectiveDate.getTime() : null;

    if (aIsFuture && bIsFuture) {
      if (timeA !== null && timeB !== null) return timeA - timeB;
      if (timeA !== null && timeB === null) return -1;
      if (timeA === null && timeB !== null) return 1;
      return 0;
    } else {
      // Untuk sesi yang sudah lewat: urutkan dari yang paling baru selesai ke yang paling lama
      if (timeA !== null && timeB !== null) return timeB - timeA;
      return 0;
    }
  });

  return matched;
}

/**
 * Helper khusus untuk mengambil daftar Kajian Hari Ini pada halaman Beranda
 */
export function getTodayKajian(
  sessions: StudySession[],
  options: {
    userLocation?: { lat: number; lng: number } | null;
    referenceTime?: Date;
    limit?: number;
  } = {}
): EvaluatedStudySession[] {
  const refTime = options.referenceTime ?? new Date();
  const evaluated = evaluateAndQuerySessions(sessions, {
    filter: {
      placement: 'all',
    },
    sort: {
      userLocation: options.userLocation,
      mode: 'auto',
    },
    referenceTime: refTime,
  });

  const todayItems = evaluated.filter((item) => item.isToday && !item.isPast);
  const maxLimit = options.limit ?? 8;

  if (todayItems.length > 0) {
    return todayItems.slice(0, maxLimit);
  }

  // Fallback ke kajian mendatang terdekat jika belum ada yang hari ini
  return evaluated.filter((item) => !item.isPast).slice(0, Math.min(maxLimit, 4));
}

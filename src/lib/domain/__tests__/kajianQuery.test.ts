import { describe, it, expect } from 'vitest';
import {
  evaluateSession,
  evaluateAndQuerySessions,
  getTodayKajian,
  formatDistanceLabel,
} from '../kajianQuery';
import type { StudySession } from '@/lib/services/kajian';

describe('formatDistanceLabel', () => {
  it('formats meters when distance is under 1 km', () => {
    expect(formatDistanceLabel(0.45)).toBe('450 m');
    expect(formatDistanceLabel(0.08)).toBe('80 m');
  });

  it('formats kilometers with 1 decimal when 1 km or more', () => {
    expect(formatDistanceLabel(1.23)).toBe('1.2 km');
    expect(formatDistanceLabel(15.78)).toBe('15.8 km');
  });

  it('returns null for invalid or null inputs', () => {
    expect(formatDistanceLabel(null)).toBeNull();
    expect(formatDistanceLabel(NaN)).toBeNull();
  });
});

describe('Kajian Schedule & Query Engine', () => {
  // Waktu referensi tetap: Senin, 9 November 2026 pukul 10:00 WIB
  const fixedNow = new Date('2026-11-09T10:00:00+07:00');

  // Monas Jakarta (-6.1754, 106.8272)
  const userMonas = { lat: -6.1754, lng: 106.8272 };

  const fixtureSessions: StudySession[] = [
    // 1. Kajian Hari Ini, Sedang Live (09:30 - 11:30) di Masjid Istiqlal (~1.2 km dari Monas)
    {
      id: 'session-live',
      speaker_name: 'Ustadz Dr. Firanda Andirja',
      title: 'Tafsir Surat Al-Baqarah',
      audience_type: 'umum',
      is_recurring: false,
      start_datetime: '2026-11-09T09:30:00+07:00',
      status: 'confirmed',
      venue_id: 'venue-istiqlal',
      venues: {
        id: 'venue-istiqlal',
        name: 'Masjid Istiqlal',
        address: 'Jl. Taman Wijaya Kusuma, Jakarta Pusat',
        location: null,
        lat: -6.1702,
        lng: 106.8315,
        facilities: { parking_car: true, akhwat_area: true },
      },
    },
    // 2. Kajian Hari Ini Nanti Sore (16:00) di Tebet (~6.5 km dari Monas)
    {
      id: 'session-today-future',
      speaker_name: 'Ustadz Yazid bin Abdul Qadir Jawas',
      title: 'Kiat Menuntut Ilmu Syari',
      audience_type: 'ikhwan',
      is_recurring: false,
      start_datetime: '2026-11-09T16:00:00+07:00',
      status: 'confirmed',
      venue_id: 'venue-tebet',
      venues: {
        id: 'venue-tebet',
        name: 'Masjid Al-Ittihad Tebet',
        address: 'Tebet Barat, Jakarta Selatan',
        location: null,
        lat: -6.2345,
        lng: 106.8521,
        facilities: { parking_car: false, akhwat_area: true },
      },
    },
    // 3. Kajian Kemarin (Selesai) di Kebayoran Baru
    {
      id: 'session-past',
      speaker_name: 'Ustadz Muhammad Nuzul Dzikri',
      title: 'Tadabbur Juz Amma',
      audience_type: 'akhwat',
      is_recurring: false,
      start_datetime: '2026-11-08T09:00:00+07:00',
      status: 'confirmed',
      venue_id: 'venue-kebayoran',
      venues: {
        id: 'venue-kebayoran',
        name: 'Masjid Nurul Iman',
        address: 'Kebayoran Baru, Jakarta Selatan',
        location: null,
        lat: -6.2488,
        lng: 106.8012,
        facilities: { parking_car: true, akhwat_area: true },
      },
    },
    // 4. Kajian Rutin (Setiap Ahad Subuh, recurring)
    {
      id: 'session-rutin',
      speaker_name: 'Ustadz Syafiq Riza Basalamah',
      title: 'Kajian Riyadhis Shalihin',
      audience_type: 'umum',
      is_recurring: true,
      recurring_pattern: 'Setiap Ahad Subuh',
      recurring_rule: { dayOfWeek: 0, time: '05:00', weeks: [1, 2, 3, 4, 5] },
      status: 'confirmed',
      venue_id: 'venue-bintaro',
      venues: {
        id: 'venue-bintaro',
        name: 'Masjid Bintaro Sektor 9',
        address: 'Tangerang Selatan, Banten',
        location: null,
        lat: -6.2891,
        lng: 106.7123,
        facilities: { parking_car: true, akhwat_area: true, kids_friendly: true },
      },
    },
    // 5. Kajian Online Murni (Tanpa Koordinat Fisik)
    {
      id: 'session-online',
      speaker_name: 'Ustadz Subhan Bawazier',
      title: 'Bedah Kitab Al-Wajiz Live',
      audience_type: 'umum',
      is_recurring: false,
      start_datetime: '2026-11-09T20:00:00+07:00',
      status: 'confirmed',
      is_online: true,
      stream_url: 'https://youtube.com/live/xyz123',
      venue_id: null,
      venues: null,
    },
  ];

  describe('evaluateSession', () => {
    it('computes distance and travel time from user coordinates', () => {
      const liveSession = fixtureSessions[0];
      const evaluated = evaluateSession(liveSession, userMonas, fixedNow);

      expect(evaluated.distanceKm).not.toBeNull();
      expect(evaluated.distanceKm!).toBeGreaterThan(0.5);
      expect(evaluated.distanceKm!).toBeLessThan(2.0);
      expect(evaluated.distanceLabel).toBe('749 m');
      expect(evaluated.isLive).toBe(true);
      expect(evaluated.isToday).toBe(true);
      expect(evaluated.isPast).toBe(false);
      expect(evaluated.hasPhysicalLocation).toBe(true);
    });

    it('handles online sessions without physical coordinates gracefully', () => {
      const onlineSession = fixtureSessions[4];
      const evaluated = evaluateSession(onlineSession, userMonas, fixedNow);

      expect(evaluated.distanceKm).toBeNull();
      expect(evaluated.distanceLabel).toBeNull();
      expect(evaluated.travelTimeLabel).toBeNull();
      expect(evaluated.hasPhysicalLocation).toBe(false);
    });
  });

  describe('Placement Filter', () => {
    it('excludes pure online sessions when placement is "map"', () => {
      const results = evaluateAndQuerySessions(fixtureSessions, {
        filter: { placement: 'map' },
        referenceTime: fixedNow,
      });

      expect(results.some((r) => r.session.id === 'session-online')).toBe(false);
      expect(results.every((r) => r.hasPhysicalLocation)).toBe(true);
    });

    it('includes online sessions when placement is "all" or "online"', () => {
      const allResults = evaluateAndQuerySessions(fixtureSessions, {
        filter: { placement: 'all' },
        referenceTime: fixedNow,
      });
      expect(allResults.some((r) => r.session.id === 'session-online')).toBe(true);

      const onlineOnly = evaluateAndQuerySessions(fixtureSessions, {
        filter: { placement: 'online' },
        referenceTime: fixedNow,
      });
      expect(onlineOnly.length).toBe(1);
      expect(onlineOnly[0].session.id).toBe('session-online');
    });
  });

  describe('Search Query Filtering', () => {
    it('matches by title, speaker, and mosque name case-insensitively', () => {
      const bySpeaker = evaluateAndQuerySessions(fixtureSessions, {
        filter: { searchQuery: 'firanda' },
        referenceTime: fixedNow,
      });
      expect(bySpeaker.length).toBe(1);
      expect(bySpeaker[0].session.id).toBe('session-live');

      const byMosque = evaluateAndQuerySessions(fixtureSessions, {
        filter: { searchQuery: 'tebet' },
        referenceTime: fixedNow,
      });
      expect(byMosque.length).toBe(1);
      expect(byMosque[0].session.id).toBe('session-today-future');
    });
  });

  describe('Audience and Facility Filtering', () => {
    it('filters by audience category', () => {
      const ikhwanOnly = evaluateAndQuerySessions(fixtureSessions, {
        filter: { audience: ['ikhwan'] },
        referenceTime: fixedNow,
      });
      expect(ikhwanOnly.every((r) => r.session.audience_type === 'ikhwan')).toBe(true);
    });

    it('filters by requiring multiple facilities', () => {
      const kidsAndCar = evaluateAndQuerySessions(fixtureSessions, {
        filter: { facilities: ['kids_friendly', 'parking_car'] },
        referenceTime: fixedNow,
      });
      expect(kidsAndCar.length).toBe(1);
      expect(kidsAndCar[0].session.id).toBe('session-rutin');
    });
  });

  describe('Time / Temporal Status Filtering', () => {
    it('hides past non-recurring sessions by default (smart filtering)', () => {
      const results = evaluateAndQuerySessions(fixtureSessions, {
        filter: { time: 'semua' },
        referenceTime: fixedNow,
      });
      expect(results.some((r) => r.session.id === 'session-past')).toBe(false);
    });

    it('shows past sessions when explicitly requesting "selesai"', () => {
      const results = evaluateAndQuerySessions(fixtureSessions, {
        filter: { time: 'selesai' },
        referenceTime: fixedNow,
      });
      expect(results.some((r) => r.session.id === 'session-past')).toBe(true);
      expect(results.some((r) => r.session.id === 'session-live')).toBe(false);
    });

    it('filters today and live sessions for "hari_ini"', () => {
      const results = evaluateAndQuerySessions(fixtureSessions, {
        filter: { time: 'hari_ini' },
        referenceTime: fixedNow,
      });
      expect(results.every((r) => r.isToday || r.isLive)).toBe(true);
    });

    it('filters recurring sessions for "rutin"', () => {
      const results = evaluateAndQuerySessions(fixtureSessions, {
        filter: { time: 'rutin' },
        referenceTime: fixedNow,
      });
      expect(results.every((r) => r.isRecurring)).toBe(true);
    });

    it('filters bookmarked sessions for "tersimpan"', () => {
      const results = evaluateAndQuerySessions(fixtureSessions, {
        filter: { time: 'tersimpan', bookmarkedIds: ['session-today-future'] },
        referenceTime: fixedNow,
      });
      expect(results.length).toBe(1);
      expect(results[0].session.id).toBe('session-today-future');
    });
  });

  describe('Schwartzian Sorting', () => {
    it('prioritizes live session first in auto mode', () => {
      const results = evaluateAndQuerySessions(fixtureSessions, {
        sort: { userLocation: userMonas, mode: 'auto' },
        referenceTime: fixedNow,
      });
      expect(results[0].session.id).toBe('session-live');
    });

    it('sorts strictly by distance ascending in distance mode', () => {
      const results = evaluateAndQuerySessions(fixtureSessions, {
        filter: { placement: 'map' },
        sort: { userLocation: userMonas, mode: 'distance' },
        referenceTime: fixedNow,
      });

      // Istiqlal (~1.2 km) harus lebih dulu daripada Tebet (~6.5 km)
      expect(results[0].session.id).toBe('session-live');
      expect(results[1].session.id).toBe('session-today-future');
      expect(results[0].distanceKm!).toBeLessThan(results[1].distanceKm!);
    });
  });

  describe('getTodayKajian convenience query', () => {
    it('returns today active kajian prioritized with given limit', () => {
      const today = getTodayKajian(fixtureSessions, {
        userLocation: userMonas,
        referenceTime: fixedNow,
        limit: 2,
      });

      expect(today.length).toBeLessThanOrEqual(2);
      expect(today[0].session.id).toBe('session-live');
    });
  });
});

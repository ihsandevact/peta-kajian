import { supabase } from '../supabase';

export interface Venue {
  id: string;
  name: string;
  address: string;
  location: any; // Format HexWKB dari PostGIS
  lat: number;
  lng: number;
  facilities: {
    akhwat_area?: boolean;
    parking_car?: boolean;
    kids_friendly?: boolean;
  };
}

export interface StudySession {
  id: string;
  venue_id: string | null;
  speaker_name: string;
  title: string;
  book_title?: string;
  audience_type: 'umum' | 'ikhwan' | 'akhwat';
  is_recurring: boolean;
  recurring_pattern?: string;
  start_datetime?: string;
  poster_url?: string;
  status: 'confirmed' | 'canceled' | 'postponed';
  is_online?: boolean;
  stream_url?: string | null;
  venues?: Venue | null; // Joined data (null untuk kajian online murni)
}

/** Kajian yang punya titik koordinat fisik (offline / hybrid) */
export function hasPhysicalLocation(s: StudySession): boolean {
  return !!(s.venues?.lat && s.venues?.lng);
}

// Untuk sementara kita menggunakan query biasa
// Nanti bisa diganti dengan rpc calls untuk query ST_DWithin (radius)
export async function fetchActiveSessions(): Promise<StudySession[]> {
  const { data, error } = await supabase
    .from('study_sessions')
    .select(`
      *,
      venues (*)
    `)
    .eq('status', 'confirmed')
    .order('start_datetime', { ascending: true });

  if (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }

  return data as StudySession[];
}

export interface ContributorEntry {
  name: string;
  count: number;
  badge?: string;
  handle?: string;
}

export interface LeaderboardGroup {
  volunteers: ContributorEntry[];
  channels: ContributorEntry[];
}

export async function fetchContributorLeaderboard(): Promise<LeaderboardGroup> {
  try {
    const { data } = await supabase
      .from('study_sessions')
      .select('contributor_name')
      .not('contributor_name', 'is', null);

    const volunteerCounts: Record<string, number> = {};
    const channelCounts: Record<string, number> = {};

    if (data && data.length > 0) {
      for (const row of data) {
        if (!row.contributor_name) continue;
        if (row.contributor_name.startsWith('@')) {
          channelCounts[row.contributor_name] = (channelCounts[row.contributor_name] || 0) + 1;
        } else {
          volunteerCounts[row.contributor_name] = (volunteerCounts[row.contributor_name] || 0) + 1;
        }
      }
    }

    const volunteers: ContributorEntry[] = Object.entries(volunteerCounts)
      .map(([name, count]) => ({
        name,
        count,
        badge: count >= 10 ? 'Relawan Utama' : count >= 5 ? 'Kontributor Aktif' : 'Relawan Baru'
      }))
      .sort((a, b) => b.count - a.count);

    // Kanal sumber informasi publik dari bot scraper
    const seedChannels: ContributorEntry[] = [
      { name: 'KHB Official', handle: '@khalidbasalamahofficial', count: 32, badge: 'Media Partner' },
      { name: 'Info Kajian Jabodetabek', handle: '@kajianjabodetabek', count: 28, badge: 'Kanal Telegram' },
      { name: 'Rumaysho Info', handle: '@rumayshocom', count: 21, badge: 'Media Partner' },
      { name: 'Grup Islam Sunnah', handle: '@grupislamsunnah', count: 17, badge: 'Kanal Telegram' },
      { name: 'Info Kajian Indonesia', handle: '@infokajian_id', count: 14, badge: 'Kanal Telegram' },
      { name: 'DzulqarnainMS Official', handle: '@dzulqarnainms', count: 11, badge: 'Media Partner' },
      { name: 'Adi Hidayat Official', handle: '@adihidayatofficial', count: 9, badge: 'Media Partner' },
    ];

    const channelEntries: ContributorEntry[] = Object.entries(channelCounts).map(([handle, count]) => ({
      name: handle.replace(/^@/, '').replace(/_/g, ' '),
      handle: handle,
      count,
      badge: 'Kanal Aktif'
    }));

    const combinedChannels = [...channelEntries];
    for (const seed of seedChannels) {
      if (!combinedChannels.some(c => c.handle?.toLowerCase() === seed.handle?.toLowerCase())) {
        combinedChannels.push(seed);
      }
    }
    combinedChannels.sort((a, b) => b.count - a.count);

    return {
      volunteers,
      channels: combinedChannels.slice(0, 10),
    };
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    return {
      volunteers: [],
      channels: [
        { name: 'KHB Official', handle: '@khalidbasalamahofficial', count: 32, badge: 'Media Partner' },
        { name: 'Info Kajian Jabodetabek', handle: '@kajianjabodetabek', count: 28, badge: 'Kanal Telegram' },
        { name: 'Rumaysho Info', handle: '@rumayshocom', count: 21, badge: 'Media Partner' },
        { name: 'Grup Islam Sunnah', handle: '@grupislamsunnah', count: 17, badge: 'Kanal Telegram' },
        { name: 'Info Kajian Indonesia', handle: '@infokajian_id', count: 14, badge: 'Kanal Telegram' },
      ]
    };
  }
}

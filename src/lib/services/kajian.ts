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

import { supabase } from '../supabase';

export type TelegramChannelStatus = 'pending' | 'approved' | 'rejected';

export interface TelegramChannel {
  id: string;
  channel_username: string;
  channel_title: string;
  city?: string | null;
  description?: string | null;
  status: TelegramChannelStatus;
  is_active: boolean;
  rejection_reason?: string | null;
  submitted_by?: string | null;
  submitted_by_name?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  last_scraped_at?: string | null;
  last_scrape_status?: string | null;
  last_scrape_count?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Bersihkan input username telegram agar standar (tanpa @ atau format URL)
 * Contoh:
 * - '@infokajianbdg' -> 'infokajianbdg'
 * - 'https://t.me/khalidbasalamahofficial' -> 'khalidbasalamahofficial'
 * - 't.me/s/kajianjabodetabek/' -> 'kajianjabodetabek'
 */
export function cleanTelegramUsername(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  cleaned = cleaned.replace(/^t\.me\//i, '');
  cleaned = cleaned.replace(/^s\//i, '');
  cleaned = cleaned.replace(/^@/, '');
  cleaned = cleaned.replace(/\/.*$/, ''); // buang path di belakang
  return cleaned.toLowerCase().trim();
}

/**
 * Mengambil channel aktif dan disetujui (untuk konsumsi scraper/publik)
 */
export async function fetchActiveTelegramChannels(): Promise<TelegramChannel[]> {
  try {
    const { data, error } = await supabase
      .from('telegram_channels')
      .select('*')
      .eq('status', 'approved')
      .eq('is_active', true)
      .order('channel_title', { ascending: true });

    if (error) {
      console.error('Error fetching active telegram channels:', error);
      return [];
    }

    return (data as TelegramChannel[]) || [];
  } catch (err) {
    console.error('Exception fetching active telegram channels:', err);
    return [];
  }
}

/**
 * Mengambil daftar channel untuk portal admin dengan opsi filter status
 */
export async function fetchAdminTelegramChannels(
  statusFilter: 'all' | TelegramChannelStatus = 'all'
): Promise<TelegramChannel[]> {
  try {
    let query = supabase.from('telegram_channels').select('*');

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admin telegram channels:', error);
      return [];
    }

    return (data as TelegramChannel[]) || [];
  } catch (err) {
    console.error('Exception fetching admin telegram channels:', err);
    return [];
  }
}

/**
 * Mengambil daftar channel yang pernah diusulkan oleh pengguna tertentu
 */
export async function fetchUserTelegramChannels(userId: string): Promise<TelegramChannel[]> {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('telegram_channels')
      .select('*')
      .eq('submitted_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user telegram channels:', error);
      return [];
    }

    return (data as TelegramChannel[]) || [];
  } catch (err) {
    console.error('Exception fetching user telegram channels:', err);
    return [];
  }
}

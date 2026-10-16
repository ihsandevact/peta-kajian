'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { ADMIN_EMAILS } from '@/lib/services/admin';
import {
  processAndSaveChannelKajian,
  type ChannelScrapeResult,
} from '@/lib/services/telegramScraper';

export interface ScrapeChannelActionParams {
  channelUsername: string;
  maxPosts?: number;
  targetStatus?: 'confirmed' | 'pending';
}

export interface ScrapeActionResult {
  success: boolean;
  result?: ChannelScrapeResult;
  error?: string;
}

/**
 * Verifikasi keamanan: Hanya Admin yang berhak memicu scraper
 */
async function verifyAdminCaller() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Autentikasi diperlukan. Silakan login terlebih dahulu.');
  }

  const isAdminByEmail = user.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim());
  if (isAdminByEmail) return { supabase, user };

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (roleData?.role !== 'admin') {
    throw new Error('Akses ditolak: Hanya administrator yang dapat menjalankan bot scraper.');
  }

  return { supabase, user };
}

/**
 * Server Action untuk menjalankan scraping satu channel Telegram secara manual
 */
export async function runTelegramChannelScraperAction({
  channelUsername,
  maxPosts = 5,
  targetStatus = 'pending',
}: ScrapeChannelActionParams): Promise<ScrapeActionResult> {
  try {
    const { supabase } = await verifyAdminCaller();

    const result = await processAndSaveChannelKajian({
      channelUsername,
      maxPosts,
      targetStatus,
      supabaseClient: supabase,
    });

    // Revalidasi cache halaman admin dan peta publik jika ada kajian baru yang disimpan
    if (result.savedCount > 0) {
      revalidatePath('/admin');
      revalidatePath('/admin/telegram');
      if (targetStatus === 'confirmed') {
        revalidatePath('/');
      }
    }

    return {
      success: true,
      result,
    };
  } catch (error: any) {
    console.error('Error in runTelegramChannelScraperAction:', error);
    return {
      success: false,
      error: error?.message || 'Terjadi kesalahan sistem saat menjalankan scraper.',
    };
  }
}

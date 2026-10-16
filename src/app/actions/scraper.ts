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

    // Update status scraping di telegram_channels jika tabel memiliki kolom tersebut
    try {
      await supabase
        .from('telegram_channels')
        .update({
          last_scraped_at: new Date().toISOString(),
          last_scrape_status: result.success ? 'success' : (result.error || 'error'),
          last_scrape_count: result.savedCount,
        })
        .ilike('channel_username', channelUsername);
    } catch (e) {
      console.warn('Gagal update statistik scraper channel:', e);
    }

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

export interface BatchScrapeResult {
  success: boolean;
  totalChannels: number;
  totalFound: number;
  totalExtracted: number;
  totalSaved: number;
  channelResults: ChannelScrapeResult[];
  error?: string;
}

/**
 * Server Action untuk menjalankan scraping ke SELURUH channel Telegram yang aktif sekaligus (Batch)
 */
export async function runBatchTelegramScraperAction(
  maxPostsPerChannel: number = 5
): Promise<BatchScrapeResult> {
  try {
    const { supabase } = await verifyAdminCaller();
    const { fetchActiveTelegramChannels } = await import('@/lib/services/telegram');
    const activeChannels = await fetchActiveTelegramChannels();

    if (activeChannels.length === 0) {
      return {
        success: true,
        totalChannels: 0,
        totalFound: 0,
        totalExtracted: 0,
        totalSaved: 0,
        channelResults: [],
      };
    }

    const channelResults: ChannelScrapeResult[] = [];
    let totalFound = 0;
    let totalExtracted = 0;
    let totalSaved = 0;

    for (const channel of activeChannels) {
      try {
        const result = await processAndSaveChannelKajian({
          channelUsername: channel.channel_username,
          maxPosts: maxPostsPerChannel,
          targetStatus: 'pending',
          supabaseClient: supabase,
        });

        // Update waktu & statistik scraping channel
        try {
          await supabase
            .from('telegram_channels')
            .update({
              last_scraped_at: new Date().toISOString(),
              last_scrape_status: result.success ? 'success' : (result.error || 'error'),
              last_scrape_count: result.savedCount,
            })
            .eq('id', channel.id);
        } catch {}

        channelResults.push(result);
        totalFound += result.foundMessages;
        totalExtracted += result.extractedCount;
        totalSaved += result.savedCount;
      } catch (err: any) {
        console.error(`Gagal scraping channel ${channel.channel_username}:`, err);
        channelResults.push({
          success: false,
          channelUsername: channel.channel_username,
          foundMessages: 0,
          extractedCount: 0,
          savedCount: 0,
          skippedDuplicatesCount: 0,
          skippedPastCount: 0,
          logs: [`Error: ${err?.message || 'Unknown'}`],
          error: err?.message,
        });
      }
    }

    if (totalSaved > 0) {
      revalidatePath('/admin');
      revalidatePath('/admin/telegram');
    }

    return {
      success: true,
      totalChannels: activeChannels.length,
      totalFound,
      totalExtracted,
      totalSaved,
      channelResults,
    };
  } catch (error: any) {
    console.error('Error in runBatchTelegramScraperAction:', error);
    return {
      success: false,
      totalChannels: 0,
      totalFound: 0,
      totalExtracted: 0,
      totalSaved: 0,
      channelResults: [],
      error: error?.message || 'Terjadi kesalahan saat menjalankan batch scraper.',
    };
  }
}


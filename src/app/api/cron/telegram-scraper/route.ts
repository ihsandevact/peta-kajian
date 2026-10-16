import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { fetchActiveTelegramChannels } from '@/lib/services/telegram';
import { processAndSaveChannelKajian } from '@/lib/services/telegramScraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 menit max untuk background batch scraper di serverless

export async function GET(req: NextRequest) {
  return handleScraperCron(req);
}

export async function POST(req: NextRequest) {
  return handleScraperCron(req);
}

async function handleScraperCron(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const queryKey = req.nextUrl.searchParams.get('key');

  // Validasi keamanan: jika CRON_SECRET terkonfigurasi, pastikan request menyertakannya
  if (cronSecret) {
    const isAuthorized =
      authHeader === `Bearer ${cronSecret}` ||
      queryKey === cronSecret;

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid CRON_SECRET' },
        { status: 401 }
      );
    }
  }

  const startTime = Date.now();
  const supabase = await createClient();

  try {
    const activeChannels = await fetchActiveTelegramChannels();

    if (activeChannels.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada channel telegram aktif untuk di-scrape.',
        totalChannels: 0,
        totalSaved: 0,
        durationMs: Date.now() - startTime,
      });
    }

    const maxPosts = parseInt(req.nextUrl.searchParams.get('max') || '5', 10);
    const results = [];
    let totalSaved = 0;
    let totalExtracted = 0;
    let totalFound = 0;
    let totalRegisteredChannels = 0;

    for (const channel of activeChannels) {
      try {
        const scrapeRes = await processAndSaveChannelKajian({
          channelUsername: channel.channel_username,
          maxPosts: maxPosts || 5,
          targetStatus: 'pending',
          supabaseClient: supabase,
        });

        // Update timestamp & status channel
        try {
          await supabase
            .from('telegram_channels')
            .update({
              last_scraped_at: new Date().toISOString(),
              last_scrape_status: scrapeRes.success ? 'success' : (scrapeRes.error || 'error'),
              last_scrape_count: scrapeRes.savedCount,
            })
            .eq('id', channel.id);
        } catch {}

        totalFound += scrapeRes.foundMessages;
        totalExtracted += scrapeRes.extractedCount;
        totalSaved += scrapeRes.savedCount;
        totalRegisteredChannels += scrapeRes.registeredChannelsCount || 0;

        results.push({
          channel: channel.channel_username,
          success: scrapeRes.success,
          savedCount: scrapeRes.savedCount,
          registeredChannelsCount: scrapeRes.registeredChannelsCount,
          skippedDuplicates: scrapeRes.skippedDuplicatesCount,
        });
      } catch (channelErr: any) {
        console.error(`Cron scraper error on channel ${channel.channel_username}:`, channelErr);
        results.push({
          channel: channel.channel_username,
          success: false,
          error: channelErr?.message || 'Error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      totalChannels: activeChannels.length,
      totalFound,
      totalExtracted,
      totalSaved,
      totalRegisteredChannels,
      channels: results,
    });
  } catch (error: any) {
    console.error('Fatal error in handleScraperCron:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error running scraper cron.',
      },
      { status: 500 }
    );
  }
}

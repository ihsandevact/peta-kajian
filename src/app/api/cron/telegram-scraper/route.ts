import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { fetchActiveTelegramChannels } from '@/lib/services/telegram';
import { processAndSaveChannelKajian } from '@/lib/services/telegramScraper';
import { recordCronLog } from '@/lib/services/cronLogger';

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
  const supabase = createAdminClient();

  try {
    const activeChannels = await fetchActiveTelegramChannels();

    if (activeChannels.length === 0) {
      const durationMs = Date.now() - startTime;
      await recordCronLog({
        job_name: 'telegram-scraper',
        status: 'success',
        duration_ms: durationMs,
        summary: {
          totalChannels: 0,
          totalSaved: 0,
          message: 'Tidak ada channel aktif',
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Tidak ada channel telegram aktif untuk di-scrape.',
        totalChannels: 0,
        totalSaved: 0,
        durationMs,
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

    const durationMs = Date.now() - startTime;

    // Catat log sukses ke database
    await recordCronLog({
      job_name: 'telegram-scraper',
      status: 'success',
      duration_ms: durationMs,
      summary: {
        totalChannels: activeChannels.length,
        totalFound,
        totalExtracted,
        totalSaved,
        totalRegisteredChannels,
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs,
      totalChannels: activeChannels.length,
      totalFound,
      totalExtracted,
      totalSaved,
      totalRegisteredChannels,
      channels: results,
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error('Fatal error in handleScraperCron:', error);

    // Catat log error ke database
    await recordCronLog({
      job_name: 'telegram-scraper',
      status: 'error',
      duration_ms: durationMs,
      error_message: error?.message || 'Internal server error running scraper cron.',
    });

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error running scraper cron.',
        durationMs,
      },
      { status: 500 }
    );
  }
}

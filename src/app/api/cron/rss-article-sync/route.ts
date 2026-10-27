import { NextRequest, NextResponse } from 'next/server';
import { syncAllArticleFeeds } from '@/lib/services/articleSync';
import { recordCronLog } from '@/lib/services/cronLogger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 menit max untuk background fetch

export async function GET(req: NextRequest) {
  return handleRssSyncCron(req);
}

export async function POST(req: NextRequest) {
  return handleRssSyncCron(req);
}

async function handleRssSyncCron(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const queryKey = req.nextUrl.searchParams.get('key');

  // Validasi otorisasi CRON_SECRET jika dikonfigurasi
  if (cronSecret) {
    const isAuthorized =
      authHeader === `Bearer ${cronSecret}` || queryKey === cronSecret;

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid CRON_SECRET' },
        { status: 401 }
      );
    }
  }

  const startTime = Date.now();

  try {
    const syncReport = await syncAllArticleFeeds();
    const durationMs = Date.now() - startTime;
    const isSuccess = syncReport.totalInserted > 0 || (syncReport.totalParsed === 0 && syncReport.errors.length === 0);

    // Catat log ke tabel system_cron_logs
    await recordCronLog({
      job_name: 'rss-article-sync',
      status: isSuccess ? 'success' : 'error',
      duration_ms: durationMs,
      summary: {
        totalSources: syncReport.totalSources,
        totalParsed: syncReport.totalParsed,
        totalInserted: syncReport.totalInserted,
        errorsCount: syncReport.errors.length,
      },
      error_message: isSuccess ? null : syncReport.errors.slice(0, 3).join(' | '),
    });

    return NextResponse.json({
      success: isSuccess,
      timestamp: new Date().toISOString(),
      durationMs,
      report: syncReport,
    });
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : 'Unknown cron error occurred';

    await recordCronLog({
      job_name: 'rss-article-sync',
      status: 'error',
      duration_ms: durationMs,
      error_message: errorMessage,
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        durationMs,
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { syncAllYoutubeChannels } from '@/lib/services/youtubeTracker';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 menit max untuk background execution

export async function GET(req: NextRequest) {
  return handleYoutubeCron(req);
}

export async function POST(req: NextRequest) {
  return handleYoutubeCron(req);
}

async function handleYoutubeCron(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const queryKey = req.nextUrl.searchParams.get('key');

  // Validasi keamanan CRON_SECRET jika dikonfigurasi
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

  try {
    const syncResult = await syncAllYoutubeChannels();
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs,
      totalChannels: syncResult.totalChannels,
      liveCount: syncResult.liveCount,
      reports: syncResult.reports,
    });
  } catch (err: any) {
    console.error('Error in YouTube tracker cron route:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Terjadi kesalahan pada cron tracker YouTube.',
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

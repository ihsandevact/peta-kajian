import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { sendWebPushNotification } from '@/lib/services/webPush';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handlePushRemindersCron(req);
}

export async function POST(req: NextRequest) {
  return handlePushRemindersCron(req);
}

async function handlePushRemindersCron(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const queryKey = req.nextUrl.searchParams.get('key');

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

  const supabase = createAdminClient();
  const now = new Date();

  // Rentang waktu: 90 menit s/d 150 menit ke depan (pusat di H-2 jam)
  const windowStart = new Date(now.getTime() + 90 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 150 * 60 * 1000).toISOString();

  try {
    // 1. Ambil kajian yang akan dimulai pada rentang tersebut
    const { data: upcomingSessions, error: sessionErr } = await supabase
      .from('study_sessions')
      .select(`
        id,
        title,
        speaker_name,
        start_datetime,
        venues ( name, address_text )
      `)
      .eq('status', 'confirmed')
      .gte('start_datetime', windowStart)
      .lte('start_datetime', windowEnd);

    if (sessionErr) {
      throw sessionErr;
    }

    if (!upcomingSessions || upcomingSessions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada kajian yang dimulai dalam rentang H-2 jam saat ini.',
        sessionsChecked: 0,
        notificationsSent: 0,
      });
    }

    let totalSent = 0;
    const details = [];

    // 2. Untuk setiap kajian, cari jamaah yang bookmark atau RSVP
    for (const session of upcomingSessions) {
      // Ambil user_id dari user_bookmarks
      const { data: bookmarkUsers } = await supabase
        .from('user_bookmarks')
        .select('user_id')
        .eq('session_id', session.id);

      // Ambil user_id dari session_attendees
      const { data: attendeeUsers } = await supabase
        .from('session_attendees')
        .select('user_id')
        .eq('session_id', session.id)
        .not('user_id', 'is', null);

      // Ambil dari session_reminders (baik user_id maupun endpoint perangkat)
      let reminderUserIds: string[] = [];
      let reminderEndpoints: string[] = [];
      try {
        const { data: reminderRows } = await supabase
          .from('session_reminders')
          .select('user_id, endpoint')
          .eq('session_id', session.id);
        if (reminderRows) {
          reminderUserIds = reminderRows.map((r: any) => r.user_id).filter(Boolean);
          reminderEndpoints = reminderRows.map((r: any) => r.endpoint).filter(Boolean);
        }
      } catch {}

      const userIds = Array.from(
        new Set([
          ...(bookmarkUsers || []).map((b) => b.user_id),
          ...(attendeeUsers || []).map((a) => a.user_id),
          ...reminderUserIds,
        ])
      ).filter(Boolean);

      // Kumpulkan push subscriptions
      let subscriptions: any[] = [];
      if (userIds.length > 0) {
        const { data: userSubs } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .in('user_id', userIds);
        if (userSubs) subscriptions.push(...userSubs);
      }

      if (reminderEndpoints.length > 0) {
        const { data: epSubs } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .in('endpoint', reminderEndpoints);
        if (epSubs) subscriptions.push(...epSubs);
      }

      // Deduplikasi endpoint
      const uniqueMap = new Map<string, any>();
      subscriptions.forEach((sub) => uniqueMap.set(sub.endpoint, sub));
      subscriptions = Array.from(uniqueMap.values());

      if (subscriptions.length === 0) continue;

      const venueName = (session.venues as any)?.name || 'Masjid Terkait';
      const payload = {
        title: `🔔 Kajian 2 Jam Lagi: ${session.title}`,
        body: `Insya Allah dimulai pukul ${new Date(session.start_datetime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} bersama ${session.speaker_name} di ${venueName}. Ketuk untuk melihat rute & detail.`,
        url: `/?session=${session.id}`,
        data: { sessionId: session.id },
      };

      let sessionSent = 0;
      for (const sub of subscriptions) {
        try {
          await sendWebPushNotification(sub, payload);
          sessionSent++;
          totalSent++;
        } catch (pushErr: any) {
          // Jika subscription sudah expired (410 Gone / 404), hapus dari DB
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }
      }

      details.push({
        sessionId: session.id,
        title: session.title,
        recipientsFound: subscriptions.length,
        notificationsSent: sessionSent,
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      sessionsCount: upcomingSessions.length,
      totalNotificationsSent: totalSent,
      details,
    });
  } catch (error: any) {
    console.error('Push reminders cron error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error executing push reminders.' },
      { status: 500 }
    );
  }
}

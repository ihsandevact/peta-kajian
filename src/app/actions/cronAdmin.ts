'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { ADMIN_EMAILS } from '@/lib/services/admin';
import {
  type CronJobName,
  fetchCronSummaries,
  fetchRecentCronLogs,
  type CronJobSummary,
  type SystemCronLog,
} from '@/lib/services/cronLogger';

async function verifyAdminAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Anda harus login terlebih dahulu.');
  }

  const isAdminByEmail = user.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim());
  if (isAdminByEmail) return { supabase, user };

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (roleData?.role !== 'admin') {
    throw new Error('Akses ditolak. Tindakan ini hanya boleh dilakukan oleh Administrator.');
  }

  return { supabase, user };
}

/**
 * Memicu eksekusi cron job secara manual dari halaman Admin Dashboard.
 */
export async function triggerCronJob(jobName: CronJobName) {
  try {
    await verifyAdminAuth();

    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'localhost:3000';
    const proto = headersList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const cronSecret = process.env.CRON_SECRET || '';

    const targetUrl = `${proto}://${host}/api/cron/${jobName}?key=${encodeURIComponent(cronSecret)}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
      },
      cache: 'no-store',
    });

    const result = await response.json();

    revalidatePath('/admin/cron');
    if (jobName === 'rss-article-sync') {
      revalidatePath('/artikel');
      revalidatePath('/');
    }

    if (!response.ok || result.success === false) {
      return {
        success: false,
        error: result.error || `Cron ${jobName} gagal dieksekusi (HTTP ${response.status}).`,
        data: result,
      };
    }

    return {
      success: true,
      message: `Cron job "${jobName}" berhasil dijalankan.`,
      data: result,
    };
  } catch (err: any) {
    console.error(`[triggerCronJob] Error executing ${jobName}:`, err);
    return {
      success: false,
      error: err.message || 'Terjadi kesalahan saat memicu cron job.',
    };
  }
}

/**
 * Mengambil ringkasan dan riwayat log cron terkini untuk dashboard admin.
 */
export async function getCronMonitoringDataAction(): Promise<{
  success: boolean;
  error?: string;
  summaries: CronJobSummary[];
  logs: SystemCronLog[];
}> {
  try {
    const { supabase } = await verifyAdminAuth();
    const [summaries, logs] = await Promise.all([
      fetchCronSummaries(supabase),
      fetchRecentCronLogs(50, supabase),
    ]);

    return {
      success: true,
      summaries,
      logs,
    };
  } catch (err: any) {
    console.error('[getCronMonitoringDataAction] Error:', err);
    return {
      success: false,
      error: err.message || 'Gagal memuat data monitoring cron.',
      summaries: [],
      logs: [],
    };
  }
}

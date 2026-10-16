import { createAdminClient } from '@/utils/supabase/admin';

export type CronJobName = 'youtube-tracker' | 'push-reminders' | 'telegram-scraper';
export type CronStatus = 'success' | 'error';

export interface SystemCronLog {
  id: string;
  job_name: CronJobName;
  status: CronStatus;
  duration_ms: number;
  summary: Record<string, any>;
  error_message?: string | null;
  executed_at: string;
}

export interface CronJobSummary {
  jobName: CronJobName;
  title: string;
  scheduleDescription: string;
  icon: string;
  latestLog: SystemCronLog | null;
}

export interface RecordCronLogParams {
  job_name: CronJobName;
  status: CronStatus;
  duration_ms: number;
  summary?: Record<string, any>;
  error_message?: string | null;
}

/**
 * Mencatat riwayat eksekusi cron job ke database secara aman (fault-tolerant).
 * Jika tabel belum ada atau koneksi database error, fungsi ini tidak akan melempar error.
 */
export async function recordCronLog(params: RecordCronLogParams): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from('system_cron_logs').insert({
      job_name: params.job_name,
      status: params.status,
      duration_ms: Math.max(0, Math.round(params.duration_ms)),
      summary: params.summary || {},
      error_message: params.error_message || null,
      executed_at: new Date().toISOString(),
    });
  } catch (err) {
    // Log di console server tanpa menggagalkan eksekusi utama cron
    console.warn('[cronLogger] Gagal menyimpan log eksekusi cron ke database:', err);
  }
}

/**
 * Mengambil ringkasan status terkini untuk 3 cron job utama.
 */
export async function fetchCronSummaries(client?: any): Promise<CronJobSummary[]> {
  const jobs: { name: CronJobName; title: string; schedule: string; icon: string }[] = [
    {
      name: 'youtube-tracker',
      title: 'YouTube Live Tracker',
      schedule: 'Setiap 15 Menit',
      icon: 'smart_display',
    },
    {
      name: 'push-reminders',
      title: 'Pengingat Notifikasi HP',
      schedule: 'Setiap Jam',
      icon: 'notifications_active',
    },
    {
      name: 'telegram-scraper',
      title: 'Telegram Channel Scraper',
      schedule: '2x Sehari (08:00 & 20:00 WIB)',
      icon: 'rss_feed',
    },
  ];

  try {
    const supabase = client || createAdminClient();
    const results: CronJobSummary[] = [];

    for (const job of jobs) {
      const { data } = await supabase
        .from('system_cron_logs')
        .select('*')
        .eq('job_name', job.name)
        .order('executed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      results.push({
        jobName: job.name,
        title: job.title,
        scheduleDescription: job.schedule,
        icon: job.icon,
        latestLog: data ? (data as SystemCronLog) : null,
      });
    }

    return results;
  } catch (err) {
    console.error('[cronLogger] Error fetching cron summaries:', err);
    return jobs.map((job) => ({
      jobName: job.name,
      title: job.title,
      scheduleDescription: job.schedule,
      icon: job.icon,
      latestLog: null,
    }));
  }
}

/**
 * Mengambil daftar riwayat eksekusi log sistem cron terakhir.
 */
export async function fetchRecentCronLogs(limit: number = 30, client?: any): Promise<SystemCronLog[]> {
  try {
    const supabase = client || createAdminClient();
    const { data, error } = await supabase
      .from('system_cron_logs')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[cronLogger] Error querying system_cron_logs:', error);
      return [];
    }

    return (data || []) as SystemCronLog[];
  } catch (err) {
    console.error('[cronLogger] Error fetching recent cron logs:', err);
    return [];
  }
}

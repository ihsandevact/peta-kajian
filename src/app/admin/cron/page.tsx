'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { checkIsAdmin } from '@/lib/services/admin';
import type {
  CronJobSummary,
  SystemCronLog,
  CronJobName,
} from '@/lib/services/cronLogger';
import { triggerCronJob, getCronMonitoringDataAction } from '@/app/actions/cronAdmin';

export default function AdminCronMonitoringPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<CronJobSummary[]>([]);
  const [logs, setLogs] = useState<SystemCronLog[]>([]);
  const [filterJob, setFilterJob] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Triggering state per job
  const [triggeringJob, setTriggeringJob] = useState<CronJobName | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const loadData = useCallback(async () => {
    try {
      const res = await getCronMonitoringDataAction();
      if (res.success) {
        setSummaries(res.summaries);
        setLogs(res.logs);
      } else if (res.error) {
        console.warn('[AdminCronMonitoringPage] Failed loading data:', res.error);
      }
    } catch (err) {
      console.error('Error loading cron monitor data:', err);
    }
  }, []);


  useEffect(() => {
    async function init() {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const admin = await checkIsAdmin(user);
      setIsAdmin(admin);

      if (admin) {
        await loadData();
      }
      setLoading(false);
    }
    init();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    showToast('Data log sistem berhasil diperbarui.');
  };

  const handleTrigger = async (jobName: CronJobName) => {
    setTriggeringJob(jobName);
    try {
      const res = await triggerCronJob(jobName);
      if (res.success) {
        showToast(res.message || `Cron "${jobName}" berhasil dijalankan!`);
        await loadData();
      } else {
        alert(res.error || `Gagal menjalankan cron ${jobName}.`);
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setTriggeringJob(null);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchJob = filterJob === 'all' || log.job_name === filterJob;
      const matchStatus = filterStatus === 'all' || log.status === filterStatus;
      return matchJob && matchStatus;
    });
  }, [logs, filterJob, filterStatus]);

  const formatRelativeTime = (isoString?: string | null) => {
    if (!isoString) return 'Belum pernah';
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Baru saja';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} mnt lalu`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} hari lalu`;
  };

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + ' WIB';
  };

  const getJobBadge = (jobName: CronJobName) => {
    switch (jobName) {
      case 'youtube-tracker':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800">
            <span className="material-symbols-outlined text-[14px]">smart_display</span>
            YouTube Tracker
          </span>
        );
      case 'push-reminders':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <span className="material-symbols-outlined text-[14px]">notifications_active</span>
            Push Reminders
          </span>
        );
      case 'telegram-scraper':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            <span className="material-symbols-outlined text-[14px]">rss_feed</span>
            Telegram Scraper
          </span>
        );
      case 'rss-article-sync':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="material-symbols-outlined text-[14px]">article</span>
            Sindikasi Artikel
          </span>
        );
      default:
        return <span>{jobName}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-on-surface-variant font-medium">Memuat data cron monitor...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 min-h-[50vh]">
        <div className="max-w-md w-full bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">lock</span>
          </div>
          <h2 className="text-lg font-bold text-on-surface">Akses Terbatas</h2>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Halaman ini hanya dapat diakses oleh Administrator Peta Kajian.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-neutral-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-medium border border-neutral-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-container-high/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-600 text-[26px]">schedule</span>
              <h1 className="text-xl sm:text-2xl font-bold text-on-surface">Monitoring Otomatisasi (Cron)</h1>
            </div>
            <p className="text-xs sm:text-[13px] text-on-surface-variant mt-1">
              Pantau jadwal, status kesehatan, dan log eksekusi background worker GitHub Actions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-container hover:bg-surface-container-high text-on-surface border border-surface-container-high transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Perbarui log status terkini"
            >
              <span className={`material-symbols-outlined text-[16px] ${isRefreshing ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>{isRefreshing ? 'Memuat...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* 4 Kartu Status Utama */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaries.map((job) => {
            const hasRun = Boolean(job.latestLog);
            const isSuccess = job.latestLog?.status === 'success';
            const isError = job.latestLog?.status === 'error';
            const isTriggering = triggeringJob === job.jobName;

            return (
              <div
                key={job.jobName}
                className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container-high/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-surface-container-highest transition-colors"
              >
                <div>
                  {/* Top Bar Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">{job.icon}</span>
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-on-surface leading-snug">{job.title}</h2>
                        <span className="text-[11px] text-outline block">{job.scheduleDescription}</span>
                      </div>
                    </div>

                    {/* Status Indicator */}
                    {hasRun ? (
                      isSuccess ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          Sukses
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                          Gagal
                        </span>
                      )
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-container text-outline">
                        Belum Berjalan
                      </span>
                    )}
                  </div>

                  {/* Summary Metric Stats */}
                  <div className="mt-4 p-3 rounded-xl bg-surface-container-low/60 border border-surface-container-high/50 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-on-surface-variant">
                      <span className="text-outline">Terakhir Berjalan:</span>
                      <span className="font-semibold text-on-surface">
                        {formatRelativeTime(job.latestLog?.executed_at)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-on-surface-variant">
                      <span className="text-outline">Durasi Eksekusi:</span>
                      <span className="font-semibold text-on-surface">
                        {job.latestLog ? `${job.latestLog.duration_ms} ms` : '-'}
                      </span>
                    </div>

                    {/* Spesifik Metrik tiap Job */}
                    {job.jobName === 'youtube-tracker' && (
                      <div className="flex items-center justify-between text-on-surface-variant pt-1 border-t border-surface-container-high/40">
                        <span className="text-outline">Sedang Live:</span>
                        <span className="font-bold text-red-600">
                          {job.latestLog?.summary?.liveCount ?? 0} Channel
                        </span>
                      </div>
                    )}

                    {job.jobName === 'push-reminders' && (
                      <div className="flex items-center justify-between text-on-surface-variant pt-1 border-t border-surface-container-high/40">
                        <span className="text-outline">Notifikasi Terkirim:</span>
                        <span className="font-bold text-primary">
                          {job.latestLog?.summary?.totalNotificationsSent ?? job.latestLog?.summary?.notificationsSent ?? 0}
                        </span>
                      </div>
                    )}

                    {job.jobName === 'telegram-scraper' && (
                      <div className="flex items-center justify-between text-on-surface-variant pt-1 border-t border-surface-container-high/40">
                        <span className="text-outline">Kajian Disimpan:</span>
                        <span className="font-bold text-emerald-600">
                          {job.latestLog?.summary?.totalSaved ?? 0} Sesi
                        </span>
                      </div>
                    )}

                    {job.jobName === 'rss-article-sync' && (
                      <div className="flex items-center justify-between text-on-surface-variant pt-1 border-t border-surface-container-high/40">
                        <span className="text-outline">Artikel Tersimpan:</span>
                        <span className="font-bold text-emerald-600">
                          {job.latestLog?.summary?.totalInserted ?? 0} Artikel
                        </span>
                      </div>
                    )}

                    {isError && job.latestLog?.error_message && (
                      <p className="text-[11px] text-red-600 font-medium truncate pt-1 border-t border-red-200">
                        Error: {job.latestLog.error_message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Tombol Jalankan Sekarang (Manual Trigger) */}
                <button
                  type="button"
                  onClick={() => handleTrigger(job.jobName)}
                  disabled={isTriggering}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Picu eksekusi manual saat ini juga"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isTriggering ? 'animate-spin' : ''}`}>
                    {isTriggering ? 'sync' : 'play_arrow'}
                  </span>
                  <span>{isTriggering ? 'Sedang Menjalankan...' : 'Jalankan Sekarang'}</span>
                </button>

                {/* Link Navigasi Entitas Terkait */}
                <div className="pt-2 text-center border-t border-surface-container-high/40">
                  {job.jobName === 'youtube-tracker' && (
                    <Link
                      href="/admin/youtube"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <span>Kelola Daftar Channel YouTube</span>
                      <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                    </Link>
                  )}
                  {job.jobName === 'telegram-scraper' && (
                    <Link
                      href="/admin/telegram"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <span>Kelola Channel Telegram & Scraper</span>
                      <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                    </Link>
                  )}
                  {job.jobName === 'push-reminders' && (
                    <Link
                      href="/admin"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <span>Lihat Jadwal di Manajemen Kajian</span>
                      <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                    </Link>
                  )}
                  {job.jobName === 'rss-article-sync' && (
                    <Link
                      href="/artikel"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <span>Lihat Artikel di Portal</span>
                      <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}

        </div>

        {/* Tabel Riwayat Log Eksekusi */}
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high/80 overflow-hidden shadow-xs space-y-0">
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container-high/60">
            <div>
              <h2 className="text-base font-bold text-on-surface">Riwayat Eksekusi Log Sistem</h2>
              <p className="text-xs text-outline mt-0.5">
                Daftar rekaman eksekusi terbaru dari GitHub Actions maupun pemicuan manual.
              </p>
            </div>

            {/* Filter Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterJob}
                onChange={(e) => setFilterJob(e.target.value)}
                className="text-xs bg-surface-container border border-surface-container-high rounded-xl px-2.5 py-1.5 text-on-surface focus:outline-none"
              >
                <option value="all">Semua Jenis Cron</option>
                <option value="youtube-tracker">YouTube Tracker</option>
                <option value="push-reminders">Push Reminders</option>
                <option value="telegram-scraper">Telegram Scraper</option>
                <option value="rss-article-sync">Sindikasi Artikel (RSS)</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs bg-surface-container border border-surface-container-high rounded-xl px-2.5 py-1.5 text-on-surface focus:outline-none"
              >
                <option value="all">Semua Status</option>
                <option value="success">Hanya Sukses</option>
                <option value="error">Hanya Gagal</option>
              </select>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <span className="material-symbols-outlined text-4xl text-outline">history_toggle_off</span>
              <p className="text-sm font-semibold text-on-surface">Belum ada riwayat log tercatat</p>
              <p className="text-xs text-outline max-w-sm mx-auto">
                Tabel log akan terisi otomatis saat GitHub Actions berjalan atau Anda dapat menguji dengan mengklik tombol &quot;Jalankan Sekarang&quot; di atas.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-low text-on-surface-variant border-b border-surface-container-high font-semibold">
                  <tr>
                    <th className="py-3 px-4">Waktu Eksekusi</th>
                    <th className="py-3 px-4">Nama Cron Job</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Durasi</th>
                    <th className="py-3 px-4">Rincian Hasil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/40 text-on-surface font-medium">
                  {filteredLogs.map((log) => {
                    const isSuccess = log.status === 'success';

                    return (
                      <tr key={log.id} className="hover:bg-surface-container-low/40 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-semibold text-on-surface">{formatDateTime(log.executed_at)}</span>
                            <span className="text-[10px] text-outline">{formatRelativeTime(log.executed_at)}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {getJobBadge(log.job_name)}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                              <span className="material-symbols-outlined text-[15px]">check_circle</span>
                              Sukses
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600">
                              <span className="material-symbols-outlined text-[15px]">error</span>
                              Gagal
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-outline">
                          {log.duration_ms} ms
                        </td>

                        <td className="py-3 px-4">
                          {isSuccess ? (
                            <div className="flex items-center gap-2 text-[11px] text-on-surface-variant flex-wrap">
                              {log.job_name === 'youtube-tracker' && (
                                <>
                                  <span>Channels: <strong>{log.summary?.totalChannels ?? '-'}</strong></span>
                                  <span>•</span>
                                  <span className="text-red-600 font-bold">Live: {log.summary?.liveCount ?? 0}</span>
                                </>
                              )}
                              {log.job_name === 'push-reminders' && (
                                <>
                                  <span>Kajian: <strong>{log.summary?.sessionsCount ?? log.summary?.sessionsChecked ?? 0}</strong></span>
                                  <span>•</span>
                                  <span>Notif Terkirim: <strong>{log.summary?.totalNotificationsSent ?? log.summary?.notificationsSent ?? 0}</strong></span>
                                </>
                              )}
                              {log.job_name === 'telegram-scraper' && (
                                <>
                                  <span>Channels: <strong>{log.summary?.totalChannels ?? '-'}</strong></span>
                                  <span>•</span>
                                  <span className="text-emerald-600 font-bold">Tersimpan: {log.summary?.totalSaved ?? 0}</span>
                                </>
                              )}
                              {log.job_name === 'rss-article-sync' && (
                                <>
                                  <span>Portal: <strong>{log.summary?.totalSources ?? '-'}</strong></span>
                                  <span>•</span>
                                  <span>Parsed: <strong>{log.summary?.totalParsed ?? 0}</strong></span>
                                  <span>•</span>
                                  <span className="text-emerald-600 font-bold">Tersimpan: {log.summary?.totalInserted ?? 0}</span>
                                  {Boolean(log.summary?.errorsCount) && (
                                    <>
                                      <span>•</span>
                                      <span className="text-red-600 font-bold">Error: {log.summary?.errorsCount}</span>
                                    </>
                                  )}
                                </>
                              )}
                              {log.summary?.message && (
                                <span className="text-outline">({log.summary.message})</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-red-600 text-[11px] font-medium">
                              {log.error_message || 'Terjadi kesalahan eksekusi.'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
  );
}

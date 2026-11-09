'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { checkIsAdmin } from '@/lib/services/admin';
import type { YoutubeChannel, ChannelSyncReport } from '@/lib/services/youtubeTracker';
import {
  syncYoutubeLiveAction,
  addYoutubeChannelAction,
  toggleYoutubeChannelAction,
  deleteYoutubeChannelAction,
} from '@/app/actions/youtube';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useConfirm } from '@/context/ConfirmDialogContext';

export default function AdminYoutubeChannelsPage() {
  const confirmDialog = useConfirm();
  const [channels, setChannels] = useState<YoutubeChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Syncing state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<{
    totalChannels: number;
    liveCount: number;
    upcomingCount?: number;
    reports: ChannelSyncReport[];
  } | null>(null);

  // Add Channel Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    channel_name: '',
    channel_handle: '',
    default_speaker_name: 'Asatidzah',
    default_city: 'Nasional',
    is_active: true,
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Processing state for toggle/delete
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    initAuthAndData();
  }, []);

  async function initAuthAndData() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const admin = await checkIsAdmin(user);
    setIsAdmin(admin);

    if (admin) {
      await loadChannels();
    }
    setLoading(false);
  }

  async function loadChannels() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('youtube_channels')
      .select('*')
      .order('is_currently_live', { ascending: false })
      .order('channel_name', { ascending: true });

    if (!error && data) {
      setChannels(data as YoutubeChannel[]);
    }
  }

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncReport(null);
    try {
      const res = await syncYoutubeLiveAction();
      if (res.success) {
        setSyncReport({
          totalChannels: res.totalChannels,
          liveCount: res.liveCount,
          upcomingCount: res.upcomingCount,
          reports: res.reports,
        });
        showToast(
          `Sinkronisasi selesai! Ditemukan ${res.liveCount} LIVE, ${res.upcomingCount || 0} Terjadwal & ${res.endedCount || 0} Rekaman.`
        );
        await loadChannels();
      } else {
        alert(res.error || 'Gagal menyinkronkan channel.');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleActive = async (channel: YoutubeChannel) => {
    setProcessingId(channel.id);
    const newStatus = !channel.is_active;
    const res = await toggleYoutubeChannelAction(channel.id, newStatus);
    if (res.success) {
      setChannels((prev) =>
        prev.map((c) => (c.id === channel.id ? { ...c, is_active: newStatus } : c))
      );
      showToast(`Status channel ${channel.channel_name} berhasil diperbarui.`);
    } else {
      alert(res.error || 'Gagal mengubah status channel.');
    }
    setProcessingId(null);
  };

  const handleDelete = async (channel: YoutubeChannel) => {
    const confirmed = await confirmDialog({
      title: 'Hapus Channel YouTube?',
      description: `Hapus channel "${channel.channel_name}" (${channel.channel_handle}) dari daftar pemantauan live streaming?`,
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      variant: 'danger',
      icon: 'delete',
    });
    if (!confirmed) return;
    setProcessingId(channel.id);
    const res = await deleteYoutubeChannelAction(channel.id);
    if (res.success) {
      setChannels((prev) => prev.filter((c) => c.id !== channel.id));
      showToast(`Channel ${channel.channel_name} berhasil dihapus.`);
    } else {
      alert(res.error || 'Gagal menghapus channel.');
    }
    setProcessingId(null);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);

    const res = await addYoutubeChannelAction(addForm);
    if (res.success) {
      setIsAddModalOpen(false);
      setAddForm({
        channel_name: '',
        channel_handle: '',
        default_speaker_name: 'Asatidzah',
        default_city: 'Nasional',
        is_active: true,
      });
      showToast('Channel dakwah baru berhasil ditambahkan!');
      await loadChannels();
    } else {
      setAddError(res.error || 'Gagal menambahkan channel.');
    }
    setAddLoading(false);
  };

  // Filter channel berdasarkan query pencarian (debounced 300ms)
  const filteredChannels = useMemo(() => {
    const q = debouncedSearchQuery.toLowerCase().trim();
    if (!q) return channels;
    return channels.filter(
      (c) =>
        c.channel_name.toLowerCase().includes(q) ||
        c.channel_handle.toLowerCase().includes(q) ||
        (c.default_speaker_name && c.default_speaker_name.toLowerCase().includes(q))
    );
  }, [channels, debouncedSearchQuery]);

  const liveCount = useMemo(() => {
    return channels.filter((c) => c.is_currently_live).length;
  }, [channels]);

  const upcomingTotal = useMemo(() => {
    return channels.reduce(
      (acc, c) => acc + (Array.isArray(c.upcoming_streams) ? c.upcoming_streams.length : 0),
      0
    );
  }, [channels]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-outline">
          <span className="material-symbols-outlined animate-spin text-[24px]">sync</span>
          <span className="text-sm">Memuat data channel YouTube...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 min-h-[50vh]">
        <div className="max-w-md w-full p-6 rounded-2xl bg-surface-container-lowest border border-surface-container-high text-center">
          <span className="material-symbols-outlined text-[48px] text-red-500 mb-2">lock</span>
          <h2 className="text-lg font-bold text-on-surface">Akses Dibatasi</h2>
          <p className="text-xs text-outline mt-1 mb-4">
            Halaman ini hanya dapat diakses oleh administrator resmi Peta Kajian.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col font-geist text-on-surface">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-surface-container-lowest border-b border-surface-container-high/60 py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-[26px]">smart_display</span>
              <h1 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
                Pelacak YouTube Live Kajian
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <p className="text-xs text-outline">
                Pantau siaran langsung & jadwal tayang channel dakwah kajian secara otomatis (0 Quota API).
              </p>
              <span className="text-outline/40 hidden sm:inline">•</span>
              <Link
                href="/admin/cron"
                className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
              >
                <span>Lihat Status Cron</span>
                <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
              </Link>
            </div>

          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Tombol Sinkronisasi Manual */}
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
            >
              <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>{isSyncing ? 'Memeriksa Live...' : 'Sinkronkan Live Sekarang'}</span>
            </button>

            {/* Tombol Tambah Channel */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 transition-colors shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Tambah Channel</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col gap-6">
        {/* STATS OVERVIEW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">live_tv</span>
            </div>
            <div>
              <p className="text-[11px] text-outline font-medium">Sedang Live</p>
              <h3 className="text-lg font-bold text-on-surface">
                {liveCount} <span className="text-xs font-normal text-outline">Channel</span>
              </h3>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">schedule</span>
            </div>
            <div>
              <p className="text-[11px] text-outline font-medium">Akan Tayang</p>
              <h3 className="text-lg font-bold text-on-surface">
                {upcomingTotal} <span className="text-xs font-normal text-outline">Siaran</span>
              </h3>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">rss_feed</span>
            </div>
            <div>
              <p className="text-[11px] text-outline font-medium">Total Channel Dipantau</p>
              <h3 className="text-lg font-bold text-on-surface">
                {channels.length} <span className="text-xs font-normal text-outline">Channel</span>
              </h3>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
            </div>
            <div>
              <p className="text-[11px] text-outline font-medium">Status Cron Tracker</p>
              <h3 className="text-xs font-bold text-emerald-600">
                Aktif (Otomatis)
              </h3>
            </div>
          </div>
        </div>

        {/* HASIL SINKRONISASI MODAL / BOX */}
        {syncReport && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600 text-[20px]">check_circle</span>
                <h4 className="font-bold text-sm text-red-900 dark:text-red-200">
                  Laporan Hasil Sinkronisasi ({syncReport.liveCount} Siaran Live, {syncReport.upcomingCount || 0} Terjadwal Ditemukan)
                </h4>
              </div>
              <button
                onClick={() => setSyncReport(null)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {syncReport.reports.map((rep) => (
                <div
                  key={rep.channelId}
                  className="p-2.5 rounded-xl bg-surface-container-lowest border border-surface-container-high text-xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-on-surface truncate">{rep.channelName}</p>
                    <p className="text-[10px] text-outline truncate">{rep.handle}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {rep.status === 'live_new' && (
                      <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                        Sesi Baru Dibuat!
                      </span>
                    )}
                    {rep.status === 'live_existing' && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                        Sedang Berlangsung
                      </span>
                    )}
                    {rep.status === 'offline' && (
                      <span className="px-2 py-0.5 rounded-full bg-surface-container text-outline text-[10px]">
                        Offline
                      </span>
                    )}
                    {rep.status === 'error' && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px]">
                        Error
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEARCH & CONTROLS */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Cari channel atau ustadz..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-container-lowest border border-surface-container-high text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <span className="text-xs text-outline font-medium">
            Menampilkan {filteredChannels.length} dari {channels.length} channel
          </span>
        </div>

        {/* CHANNEL TABLE / LIST */}
        <div className="rounded-2xl border border-surface-container-high bg-surface-container-lowest overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container border-b border-surface-container-high text-outline uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-4">Channel & Handle</th>
                  <th className="py-3 px-4">Status Live</th>
                  <th className="py-3 px-4">Pemateri Default</th>
                  <th className="py-3 px-4">Kota</th>
                  <th className="py-3 px-4 text-center">Aktifkan Polling</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {filteredChannels.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-outline">
                      Tidak ada channel YouTube yang sesuai dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredChannels.map((channel) => {
                    const isLive = channel.is_currently_live;
                    const handleClean = channel.channel_handle.replace(/^@/, '');
                    const liveUrl = `https://www.youtube.com/@${handleClean}/live`;

                    return (
                      <tr key={channel.id} className="hover:bg-surface-container/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-red-600/10 text-red-600 flex items-center justify-center font-bold text-xs shrink-0">
                              {channel.channel_name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-on-surface truncate">{channel.channel_name}</p>
                              <a
                                href={`https://www.youtube.com/@${handleClean}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-outline hover:text-red-600 font-mono flex items-center gap-1"
                              >
                                <span>{channel.channel_handle}</span>
                                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                              </a>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1.5 max-w-xs">
                            {isLive ? (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold w-fit animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                  SEDANG LIVE
                                </span>
                                {channel.current_video_title && (
                                  <p className="text-[11px] text-on-surface line-clamp-1 font-medium">
                                    {channel.current_video_title}
                                  </p>
                                )}
                                <a
                                  href={liveUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-red-600 hover:underline flex items-center gap-0.5"
                                >
                                  <span>Buka Video</span>
                                  <span className="material-symbols-outlined text-[11px]">videocam</span>
                                </a>
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container text-outline text-[10px] font-medium w-fit">
                                Offline
                              </span>
                            )}

                            {channel.upcoming_streams && channel.upcoming_streams.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold w-fit"
                                title={channel.upcoming_streams.map((u) => u.title).join('\n')}
                              >
                                <span className="material-symbols-outlined text-[12px]">schedule</span>
                                <span>{channel.upcoming_streams.length} Terjadwal</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-on-surface font-medium">
                          {channel.default_speaker_name || 'Asatidzah'}
                        </td>

                        <td className="py-3.5 px-4 text-outline">
                          {channel.default_city || 'Nasional'}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleToggleActive(channel)}
                            disabled={processingId === channel.id}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors inline-flex items-center ${
                              channel.is_active ? 'bg-primary justify-end' : 'bg-surface-container-highest justify-start'
                            }`}
                            title={channel.is_active ? 'Aktif - klik untuk nonaktifkan' : 'Nonaktif - klik untuk aktifkan'}
                          >
                            <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleDelete(channel)}
                            disabled={processingId === channel.id}
                            className="p-1.5 rounded-lg text-outline hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            title="Hapus Channel"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL TAMBAH CHANNEL BARU */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md p-6 border border-surface-container-high shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-on-surface">Tambah Channel YouTube</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {addError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Nama Channel / Media Dakwah <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ashiil TV"
                  value={addForm.channel_name}
                  onChange={(e) => setAddForm({ ...addForm, channel_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container border border-surface-container-high text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Handle YouTube (@username) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: @AshiilTV atau AshiilTV"
                  value={addForm.channel_handle}
                  onChange={(e) => setAddForm({ ...addForm, channel_handle: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container border border-surface-container-high text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                />
                <p className="text-[10px] text-outline mt-1">
                  Sistem otomatis mengecek URL: <code>https://www.youtube.com/@handle/live</code>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Pemateri Cadangan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Asatidzah Ashiil TV"
                  value={addForm.default_speaker_name}
                  onChange={(e) => setAddForm({ ...addForm, default_speaker_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container border border-surface-container-high text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Kota / Wilayah Siaran
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Bekasi / Nasional"
                  value={addForm.default_city}
                  onChange={(e) => setAddForm({ ...addForm, default_city: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container border border-surface-container-high text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-outline hover:text-on-surface"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 disabled:opacity-50"
                >
                  {addLoading ? 'Menyimpan...' : 'Simpan Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

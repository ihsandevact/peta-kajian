'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { checkIsAdmin } from '@/lib/services/admin';
import {
  fetchAdminTelegramChannels,
  type TelegramChannel,
  type TelegramChannelStatus,
  cleanTelegramUsername,
} from '@/lib/services/telegram';
import {
  approveTelegramChannel,
  rejectTelegramChannel,
  toggleTelegramChannelStatus,
  adminCreateTelegramChannel,
  deleteTelegramChannel,
} from '@/app/actions/telegram';
import AdminScraperModal from '@/components/AdminScraperModal';
import { runBatchTelegramScraperAction } from '@/app/actions/scraper';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useConfirm } from '@/context/ConfirmDialogContext';

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected';

export default function AdminTelegramChannelsPage() {
  const confirmDialog = useConfirm();
  const [channels, setChannels] = useState<TelegramChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal AI Scraper
  const [isScraperModalOpen, setIsScraperModalOpen] = useState(false);
  const [scraperTargetChannel, setScraperTargetChannel] = useState<string | null>(null);

  // Modal Tambah Channel
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    username: '',
    title: '',
    city: '',
    description: '',
    isActive: true,
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Modal Tolak Channel
  const [rejectingChannel, setRejectingChannel] = useState<TelegramChannel | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  // Batch Scraper State
  const [isBatchScraping, setIsBatchScraping] = useState(false);
  const [pendingScraperKajianCount, setPendingScraperKajianCount] = useState(0);

  const handleBatchScrape = async () => {
    const confirmed = await confirmDialog({
      title: 'Jalankan Batch Scraper?',
      description: 'Bot scraper akan memindai seluruh channel Telegram yang aktif secara otomatis untuk mencari jadwal kajian terbaru.',
      confirmText: 'Jalankan Sekarang',
      cancelText: 'Batal',
      variant: 'primary',
      icon: 'smart_toy',
    });
    if (!confirmed) return;
    setIsBatchScraping(true);
    try {
      const res = await runBatchTelegramScraperAction(5);
      if (res.success) {
        showToast(`Alhamdulillah! Berhasil memproses ${res.totalChannels} channel. Total kajian baru: ${res.totalSaved}`);
        await loadData();
      } else {
        alert(res.error || 'Terjadi kesalahan saat batch scraping.');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menjalankan batch scraper.');
    } finally {
      setIsBatchScraping(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const adminCheck = await checkIsAdmin(user);
    setIsAdmin(adminCheck);

    if (adminCheck) {
      const [data, countRes] = await Promise.all([
        fetchAdminTelegramChannels('all'),
        supabase
          .from('study_sessions')
          .select('id', { count: 'exact', head: true })
          .ilike('contributor_name', '@%')
          .eq('status', 'pending'),
      ]);
      setChannels(data);
      setPendingScraperKajianCount(countRes.count || 0);
    }
    setLoading(false);
  }, []);


  useEffect(() => {
    loadData();
  }, [loadData]);

  // Statistik Channel
  const stats = useMemo(() => {
    return {
      total: channels.length,
      active: channels.filter((c) => c.status === 'approved' && c.is_active).length,
      pending: channels.filter((c) => c.status === 'pending').length,
      rejected: channels.filter((c) => c.status === 'rejected').length,
    };
  }, [channels]);

  // Filter & Search
  const filteredChannels = useMemo(() => {
    return channels.filter((item) => {
      // Filter Tab
      if (activeTab === 'pending' && item.status !== 'pending') return false;
      if (activeTab === 'approved' && item.status !== 'approved') return false;
      if (activeTab === 'rejected' && item.status !== 'rejected') return false;

      // Search Query (debounced 300ms)
      if (debouncedSearchQuery.trim()) {
        const q = debouncedSearchQuery.toLowerCase();
        const matchUser = item.channel_username.toLowerCase().includes(q);
        const matchTitle = item.channel_title.toLowerCase().includes(q);
        const matchCity = item.city?.toLowerCase().includes(q);
        const matchSubmitter = item.submitted_by_name?.toLowerCase().includes(q);
        return matchUser || matchTitle || matchCity || matchSubmitter;
      }

      return true;
    });
  }, [channels, activeTab, debouncedSearchQuery]);

  // Handler: Setujui Channel
  const handleApprove = async (channel: TelegramChannel) => {
    setProcessingId(channel.id);
    try {
      const res = await approveTelegramChannel(channel.id);
      if (res.success) {
        showToast(`Channel @${channel.channel_username} berhasil disetujui.`);
        await loadData();
      } else {
        alert(res.error || 'Gagal menyetujui channel.');
      }
    } finally {
      setProcessingId(null);
    }
  };

  // Handler: Tolak Channel
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingChannel) return;

    setRejectLoading(true);
    try {
      const res = await rejectTelegramChannel(rejectingChannel.id, rejectionReason);
      if (res.success) {
        showToast(`Channel @${rejectingChannel.channel_username} telah ditolak.`);
        setRejectingChannel(null);
        setRejectionReason('');
        await loadData();
      } else {
        alert(res.error || 'Gagal menolak channel.');
      }
    } finally {
      setRejectLoading(false);
    }
  };

  // Handler: Toggle Aktif/Nonaktif
  const handleToggleActive = async (channel: TelegramChannel) => {
    setProcessingId(channel.id);
    const newStatus = !channel.is_active;
    try {
      const res = await toggleTelegramChannelStatus(channel.id, newStatus);
      if (res.success) {
        showToast(
          `Channel @${channel.channel_username} ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}.`
        );
        await loadData();
      } else {
        alert(res.error || 'Gagal mengubah status aktif.');
      }
    } finally {
      setProcessingId(null);
    }
  };

  // Handler: Hapus Channel
  const handleDelete = async (channel: TelegramChannel) => {
    const confirmDelete = await confirmDialog({
      title: 'Hapus Channel Telegram?',
      description: `Apakah Anda yakin ingin menghapus channel @${channel.channel_username} ("${channel.channel_title}") dari daftar?`,
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      variant: 'danger',
      icon: 'delete',
    });
    if (!confirmDelete) return;

    setProcessingId(channel.id);
    try {
      const res = await deleteTelegramChannel(channel.id);
      if (res.success) {
        showToast(`Channel @${channel.channel_username} berhasil dihapus.`);
        await loadData();
      } else {
        alert(res.error || 'Gagal menghapus channel.');
      }
    } finally {
      setProcessingId(null);
    }
  };

  // Handler: Tambah Channel Resmi Langsung
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);

    const cleanedUser = cleanTelegramUsername(addForm.username);
    if (!cleanedUser) {
      setAddError('Username Telegram tidak valid.');
      setAddLoading(false);
      return;
    }

    if (!addForm.title.trim()) {
      setAddError('Nama channel atau komunitas wajib diisi.');
      setAddLoading(false);
      return;
    }

    try {
      const res = await adminCreateTelegramChannel({
        channelUsername: cleanedUser,
        channelTitle: addForm.title.trim(),
        city: addForm.city.trim() || undefined,
        description: addForm.description.trim() || undefined,
        isActive: addForm.isActive,
      });

      if (res.success) {
        showToast(`Channel @${cleanedUser} berhasil disimpan.`);
        setIsAddModalOpen(false);
        setAddForm({ username: '', title: '', city: '', description: '', isActive: true });
        await loadData();
      } else {
        setAddError(res.error || 'Gagal menyimpan channel.');
      }
    } catch (err: any) {
      setAddError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="w-full font-geist text-on-surface">
      <main className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
      {/* Toast Notification */}
        {/* Header Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-container-high/60 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">rss_feed</span>
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-on-surface">
                Kelola Channel Telegram
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-outline mt-1">
              Sumber target pemantauan bot AI scraper dan pengajuan usulan channel dari komunitas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBatchScrape}
              disabled={isBatchScraping}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-xs transition-colors cursor-pointer"
              title="Jalankan scraping otomatis ke seluruh channel aktif sekaligus"
            >
              <span className={`material-symbols-outlined text-[18px] ${isBatchScraping ? 'animate-spin' : ''}`}>
                {isBatchScraping ? 'progress_activity' : 'bolt'}
              </span>
              <span>{isBatchScraping ? 'Memproses Semua...' : 'Jalankan Semua Channel'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setScraperTargetChannel(null);
                setIsScraperModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-white shadow-xs transition-colors cursor-pointer border border-neutral-700"
              title="Jalankan bot AI untuk menyadap pengumuman dari channel Telegram"
            >
              <span className="material-symbols-outlined text-[18px] text-purple-400">smart_toy</span>
              <span>Scrape Per Channel</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Tambah Channel Resmi</span>
            </button>
          </div>
        </div>

        {/* Banner Pintas Moderasi Kajian Scraping (Jika Ada yang Pending) */}
        {pendingScraperKajianCount > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[24px]">notifications_active</span>
              <div>
                <p className="text-sm font-bold">
                  Ada {pendingScraperKajianCount} kajian hasil scraping yang menunggu kurasi Anda
                </p>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                  Kajian baru dari channel Telegram perlu ditinjau sebelum otomatis tampil di peta publik.
                </p>
              </div>
            </div>
            <Link
              href="/admin?filter=pending"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors shrink-0"
            >
              <span>Buka Antrean Moderasi</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        )}

        {/* Banner Otomasi Cron Scraper */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-surface-container border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <span className="p-2 rounded-xl bg-purple-500/15 text-purple-700 dark:text-purple-300 shrink-0">
              <span className="material-symbols-outlined text-[20px]">schedule</span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-on-surface text-sm">Automasi Bot Scraper Terjadwal</span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                  Aktif via GitHub Actions
                </span>
              </div>
              <p className="text-outline mt-0.5">
                Channel aktif akan disadap otomatis berkala. Pantau kesehatan background worker di pusat komando.
              </p>
            </div>
          </div>
          <Link
            href="/admin/cron"
            className="w-full sm:w-auto px-3.5 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold rounded-xl border border-surface-container-high transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-2xs text-xs"
          >
            <span className="material-symbols-outlined text-[16px] text-purple-600">monitoring</span>
            <span>Lihat Log & Status di Monitoring Cron</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </div>


        {/* Akses Ditolak Alert (Jika Bukan Admin) */}
        {!loading && !isAdmin && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-600 text-[24px] shrink-0">lock</span>
            <div>
              <h2 className="text-sm font-bold">Akses Terbatas</h2>
              <p className="text-xs mt-1 text-amber-800 dark:text-amber-300">
                Halaman ini khusus untuk administrator. Silakan login menggunakan akun dengan hak akses admin.
              </p>
            </div>
          </div>
        )}

        {/* Statistik Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-surface-container border border-surface-container-high flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-outline">Total Channel</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-on-surface">{stats.total}</span>
              <span className="material-symbols-outlined text-outline text-[20px]">send</span>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Aktif Dipantau</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-400">
                {stats.active}
              </span>
              <span className="material-symbols-outlined text-emerald-600 text-[20px]">check_circle</span>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">Menunggu Review</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-700 dark:text-amber-400">
                {stats.pending}
              </span>
              <span className="material-symbols-outlined text-amber-600 text-[20px]">pending</span>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/40 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-300">Ditolak</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-rose-700 dark:text-rose-400">
                {stats.rejected}
              </span>
              <span className="material-symbols-outlined text-rose-600 text-[20px]">cancel</span>
            </div>
          </div>
        </div>

        {/* Toolbar: Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-surface-container rounded-2xl border border-surface-container-high/60 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              Semua ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              <span>Menunggu Review</span>
              {stats.pending > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-600 text-white">
                  {stats.pending}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('approved')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'approved'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              Disetujui / Aktif
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rejected')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'rejected'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              Ditolak
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari username, nama, kota..."
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-xl bg-surface-container border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-on-surface placeholder:text-outline/70 transition-all"
            />
          </div>
        </div>

        {/* Tabel / Daftar Channel */}
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high/80 overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-12 text-center text-outline flex flex-col items-center gap-3">
              <span className="material-symbols-outlined animate-spin text-[32px] text-purple-600">
                progress_activity
              </span>
              <p className="text-xs sm:text-sm font-medium">Memuat daftar channel Telegram...</p>
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="p-12 text-center text-outline space-y-2">
              <span className="material-symbols-outlined text-[40px] text-outline/60">
                rss_feed
              </span>
              <p className="text-sm font-semibold text-on-surface">Tidak ada channel ditemukan</p>
              <p className="text-xs text-outline max-w-sm mx-auto">
                {searchQuery
                  ? `Tidak ada channel yang cocok dengan kata kunci "${searchQuery}".`
                  : 'Belum ada data channel pada filter ini.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-surface-container-high/50">
              {filteredChannels.map((channel) => {
                const isProcessing = processingId === channel.id;
                const isPending = channel.status === 'pending';
                const isApproved = channel.status === 'approved';
                const isRejected = channel.status === 'rejected';

                return (
                  <div
                    key={channel.id}
                    className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-surface-container/30 transition-colors"
                  >
                    {/* Info Utama Channel */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold text-sm sm:text-base text-on-surface truncate">
                          {channel.channel_title}
                        </h2>

                        {/* Status Badge */}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                            <span className="material-symbols-outlined text-[13px]">pending</span>
                            Menunggu Review
                          </span>
                        )}

                        {isApproved && channel.is_active && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                            <span className="material-symbols-outlined text-[13px]">check_circle</span>
                            Aktif Dipantau
                          </span>
                        )}

                        {isApproved && !channel.is_active && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-300">
                            <span className="material-symbols-outlined text-[13px]">pause_circle</span>
                            Dijeda (Nonaktif)
                          </span>
                        )}

                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                            <span className="material-symbols-outlined text-[13px]">cancel</span>
                            Ditolak
                          </span>
                        )}

                        {channel.city && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-container text-outline border border-surface-container-high">
                            <span className="material-symbols-outlined text-[12px]">location_on</span>
                            {channel.city}
                          </span>
                        )}
                      </div>

                      {/* Telegram Username Link */}
                      <div className="flex items-center gap-2 text-xs">
                        <a
                          href={`https://t.me/s/${channel.channel_username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-semibold hover:underline"
                          title="Buka Telegram Web Preview"
                        >
                          <span className="material-symbols-outlined text-[14px]">send</span>
                          <span>@{channel.channel_username}</span>
                          <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                        </a>

                        <span className="text-outline">•</span>

                        <span className="text-outline text-[11px]">
                          Ditambahkan:{' '}
                          {new Date(channel.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>

                        {channel.submitted_by_name && (
                          <>
                            <span className="text-outline">•</span>
                            <span className="text-outline text-[11px]">
                              Oleh: <strong className="text-on-surface">{channel.submitted_by_name}</strong>
                            </span>
                          </>
                        )}

                        {channel.last_scraped_at && (
                          <>
                            <span className="text-outline">•</span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium text-[11px] inline-flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[13px]">history</span>
                              <span>
                                Terakhir:{' '}
                                {new Date(channel.last_scraped_at).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                                {channel.last_scrape_count !== undefined ? ` (${channel.last_scrape_count} baru)` : ''}
                              </span>
                            </span>
                          </>
                        )}
                      </div>

                      {/* Deskripsi & Catatan Penolakan */}
                      {channel.description && (
                        <p className="text-xs text-outline line-clamp-2 mt-1">
                          {channel.description}
                        </p>
                      )}

                      {channel.rejection_reason && (
                        <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-[11px] text-rose-800 dark:text-rose-300 mt-1.5 flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5">info</span>
                          <span>
                            <strong>Alasan Ditolak:</strong> {channel.rejection_reason}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Tombol Aksi Moderasi */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 shrink-0 border-t lg:border-t-0 border-surface-container-high/40">
                      {/* Jika Status Pending */}
                      {isPending && (
                        <>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleApprove(channel)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[16px]">check</span>
                            <span>Setujui</span>
                          </button>

                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              setRejectingChannel(channel);
                              setRejectionReason('');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                            <span>Tolak</span>
                          </button>
                        </>
                      )}

                      {/* Jika Status Approved: Tombol Scrape & Toggle Aktif/Nonaktif */}
                      {isApproved && (
                        <>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              setScraperTargetChannel(channel.channel_username);
                              setIsScraperModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 transition-colors cursor-pointer disabled:opacity-50"
                            title={`Scrape jadwal kajian langsung dari channel @${channel.channel_username}`}
                          >
                            <span className="material-symbols-outlined text-[16px]">sync</span>
                            <span>Scrape</span>
                          </button>

                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleToggleActive(channel)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                              channel.is_active
                                ? 'bg-surface-container text-on-surface hover:bg-surface-container-high border border-surface-container-high'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300'
                            }`}
                            title={channel.is_active ? 'Klik untuk menjeda scraping channel ini' : 'Klik untuk mengaktifkan scraper'}
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {channel.is_active ? 'pause' : 'play_arrow'}
                            </span>
                            <span>{channel.is_active ? 'Jeda' : 'Aktifkan'}</span>
                          </button>
                        </>
                      )}

                      {/* Tombol Hapus */}
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleDelete(channel)}
                        className="p-1.5 rounded-xl text-outline hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer disabled:opacity-50"
                        title="Hapus Channel"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal Tambah Channel Resmi */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-3xl max-w-md w-full border border-surface-container-high shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">add_circle</span>
                </span>
                <h3 className="font-bold text-base text-on-surface">Tambah Channel Resmi</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-outline cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {addError && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Username / Link Channel Telegram <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: infokajianbdg atau @infokajianbdg"
                  value={addForm.username}
                  onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-surface-container border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
                {addForm.username && (
                  <p className="text-[11px] text-outline mt-1">
                    Preview: <strong className="text-sky-600">@{cleanTelegramUsername(addForm.username)}</strong> (t.me/s/{cleanTelegramUsername(addForm.username)})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Nama Channel / Komunitas <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Info Kajian Bandung & Sekitarnya"
                  value={addForm.title}
                  onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-surface-container border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Cakupan Wilayah / Kota <span className="text-outline font-normal">(opsional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Bandung / Jawa Barat / Nasional"
                  value={addForm.city}
                  onChange={(e) => setAddForm({ ...addForm, city: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-surface-container border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Catatan / Deskripsi <span className="text-outline font-normal">(opsional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan jenis kajian atau jadwal rilis..."
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-surface-container border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={addForm.isActive}
                  onChange={(e) => setAddForm({ ...addForm, isActive: e.target.checked })}
                  className="rounded border-surface-container-high text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="isActiveToggle" className="text-xs font-medium text-on-surface cursor-pointer">
                  Langsung aktifkan untuk pemantauan scraper
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high/60">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-outline hover:bg-surface-container cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {addLoading ? 'Menyimpan...' : 'Simpan Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tolak Usulan Channel */}
      {rejectingChannel && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-3xl max-w-md w-full border border-surface-container-high shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">cancel</span>
                </span>
                <h3 className="font-bold text-base text-on-surface">Tolak Usulan Channel</h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingChannel(null)}
                className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-outline cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-xs text-outline">
              Anda akan menolak usulan channel{' '}
              <strong className="text-on-surface">
                @{rejectingChannel.channel_username} ({rejectingChannel.channel_title})
              </strong>
              .
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Alasan Penolakan <span className="text-outline font-normal">(opsional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Contoh: Bukan channel kajian sunnah / Channel bersifat privat / Sudah tidak aktif"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-surface-container border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high/60">
                <button
                  type="button"
                  onClick={() => setRejectingChannel(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-outline hover:bg-surface-container cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={rejectLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {rejectLoading ? 'Memproses...' : 'Tolak Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal AI Telegram Scraper Runner */}
      <AdminScraperModal
        isOpen={isScraperModalOpen}
        onClose={() => setIsScraperModalOpen(false)}
        initialSelectedChannel={scraperTargetChannel}
        channels={channels}
        onFinished={loadData}
      />
    </div>
  );
}

'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { fetchSessionsByStatus, fetchAdminStats } from '@/lib/services/admin';
import { approveSession, rejectSession, togglePublishSession, toggleTestSession } from '@/app/actions/admin';
import type { StudySession } from '@/lib/services/kajian';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { useAttendance } from '@/utils/attendance';
import AdminScraperModal from '@/components/AdminScraperModal';
import { fetchActiveTelegramChannels, type TelegramChannel } from '@/lib/services/telegram';

const EditSessionModal = dynamic(() => import('@/components/EditSessionModal'), {
  ssr: false,
});

function SessionPosterThumbnail({ url, title }: { url?: string | null; title: string }) {
  const [hasError, setHasError] = useState(false);

  const isValidUrl =
    typeof url === 'string' &&
    url.trim() !== '' &&
    url.toLowerCase() !== 'null' &&
    url.toLowerCase() !== 'undefined' &&
    (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'));

  if (!isValidUrl || hasError) {
    return null;
  }

  return (
    <div className="w-full sm:w-36 h-40 sm:h-36 rounded-xl overflow-hidden bg-surface-container shrink-0 border border-surface-container-high relative">
      <img
        src={url}
        alt={`Poster ${title}`}
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export default function AdminModerationPage() {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ pending: 0, confirmed: 0, rejected: 0, total: 0, totalAttendees: 0 });
  const { getExtraCount } = useAttendance();

  const effectiveTotalAttendees = useMemo(() => {
    return sessions.reduce((acc, s) => acc + Math.max(0, (s.attendees_count || 0) + getExtraCount(s.id)), 0);
  }, [sessions, getExtraCount]);

  // Moderation state
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingSession, setRejectingSession] = useState<StudySession | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Scraper Modal State
  const [channels, setChannels] = useState<TelegramChannel[]>([]);
  const [isScraperModalOpen, setIsScraperModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, statsData, channelsData] = await Promise.all([
        fetchSessionsByStatus('all'),
        fetchAdminStats(),
        fetchActiveTelegramChannels(),
      ]);
      setSessions(data);
      setStats(statsData);
      setChannels(channelsData);
    } catch (err) {
      console.error('Error loading admin sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Toggle Publish (Publish / Unpublish)
  const handleTogglePublish = async (id: string, title: string, publish: boolean) => {
    setProcessingId(id);
    try {
      const res = await togglePublishSession(id, publish);
      if (res.success) {
        setToastMessage(
          publish
            ? `Kajian "${title}" berhasil disetujui & dipublikasikan ke peta!`
            : `Kajian "${title}" berhasil di-unpublish (ditarik dari peta publik).`
        );
        await loadData();
      } else {
        alert(res.error || 'Gagal mengubah status publikasi.');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = (id: string, title: string) => handleTogglePublish(id, title, true);

  const handleToggleTest = async (sessionId: string, title: string, currentTest: boolean) => {
    setProcessingId(sessionId);
    try {
      const res = await toggleTestSession(sessionId, !currentTest);
      if (res.success) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, is_test: !currentTest } : s))
        );
        setToastMessage(
          !currentTest
            ? `Kajian "${title}" sekarang ditandai sebagai DATA TEST (hanya terlihat oleh akun Admin).`
            : `Kajian "${title}" sekarang berstatus PUBLIK biasa.`
        );
      } else {
        alert(res.error || 'Gagal mengubah status testing.');
      }
    } catch {
      alert('Terjadi kesalahan sistem.');
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Reject Submit
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingSession) return;
    setProcessingId(rejectingSession.id);

    try {
      const res = await rejectSession(rejectingSession.id, rejectionReason);
      if (res.success) {
        setToastMessage(`Kajian "${rejectingSession.title}" ditolak.`);
        setRejectingSession(null);
        setRejectionReason('');
        await loadData();
      } else {
        alert(res.error || 'Gagal menolak kajian.');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setProcessingId(null);
    }
  };

  // Filtered Sessions
  const filteredList = useMemo(() => {
    return sessions.filter((s) => {
      // Tab filter
      if (activeTab !== 'all' && s.status !== activeTab) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mTitle = s.title?.toLowerCase().includes(q);
        const mSpeaker = s.speaker_name?.toLowerCase().includes(q);
        const mVenue = s.venues?.name?.toLowerCase().includes(q);
        const mContributor = s.contributor_name?.toLowerCase().includes(q);
        if (!mTitle && !mSpeaker && !mVenue && !mContributor) return false;
      }

      return true;
    });
  }, [sessions, activeTab, searchQuery]);

  return (
    <div className="w-full font-geist text-on-surface">
      <main className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 flex flex-col gap-6">
        {/* Toast Notifikasi */}
        {toastMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="hover:opacity-75">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Header & Stats Cards */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
                <span>Antrean Kurasi & Moderasi Kajian</span>
              </h1>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
                Tinjau dan setujui kiriman kajian dari relawan sebelum tampil di peta publik
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsScraperModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-colors w-max cursor-pointer"
                title="Tarik info kajian terbaru dari channel Telegram menggunakan AI Scraper"
              >
                <span className="material-symbols-outlined text-[16px] text-purple-600 dark:text-purple-400">smart_toy</span>
                <span>Tarik Info Telegram</span>
              </button>

              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-on-surface-variant bg-surface-container-low hover:bg-surface-container border border-surface-container-high transition-colors w-max cursor-pointer"
              >
                <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
                  refresh
                </span>
                <span>Segarkan Antrean</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
            <div
              onClick={() => setActiveTab('pending')}
              className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-amber-500/10 border-amber-500 shadow-sm'
                  : 'bg-surface-container-lowest border-surface-container-high/70 hover:bg-surface-container-low'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-semibold text-amber-700 dark:text-amber-400">Menunggu Kurasi</span>
                <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-amber-600">hourglass_top</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-amber-800 dark:text-amber-300 mt-1">{stats.pending}</p>
            </div>

            <div
              onClick={() => setActiveTab('confirmed')}
              className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
                activeTab === 'confirmed'
                  ? 'bg-emerald-500/10 border-emerald-500 shadow-sm'
                  : 'bg-surface-container-lowest border-surface-container-high/70 hover:bg-surface-container-low'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-400">Disetujui (Tayang)</span>
                <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-emerald-600">check_circle</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-1">{stats.confirmed}</p>
            </div>

            <div
              onClick={() => setActiveTab('rejected')}
              className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
                activeTab === 'rejected'
                  ? 'bg-red-500/10 border-red-500 shadow-sm'
                  : 'bg-surface-container-lowest border-surface-container-high/70 hover:bg-surface-container-low'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-semibold text-red-700 dark:text-red-400">Ditolak</span>
                <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-red-600">cancel</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-red-800 dark:text-red-300 mt-1">{stats.rejected}</p>
            </div>

            <div
              onClick={() => setActiveTab('all')}
              className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-primary/10 border-primary shadow-sm'
                  : 'bg-surface-container-lowest border-surface-container-high/70 hover:bg-surface-container-low'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-semibold text-on-surface-variant">Semua Kajian</span>
                <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-outline">calendar_month</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-on-surface mt-1">{stats.total}</p>
            </div>

            <div
              className="p-3 sm:p-4 rounded-2xl border transition-all bg-surface-container-lowest border-surface-container-high/70"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-semibold text-teal-700 dark:text-teal-400">Total Jamaah RSVP</span>
                <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-teal-600">groups</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-teal-800 dark:text-teal-300 mt-1">{effectiveTotalAttendees}</p>
            </div>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="bg-surface-container-lowest border border-surface-container-high/70 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Tab Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {(
              [
                { key: 'pending', label: 'Menunggu Kurasi', count: stats.pending, icon: 'hourglass_top' },
                { key: 'confirmed', label: 'Disetujui', count: stats.confirmed, icon: 'check_circle' },
                { key: 'rejected', label: 'Ditolak', count: stats.rejected, icon: 'cancel' },
                { key: 'all', label: 'Semua', count: stats.total, icon: 'list' },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20' : 'bg-surface-container-high'}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined absolute left-3 top-2 text-outline text-[16px]">
              search
            </span>
            <input
              type="text"
              placeholder="Cari judul, ustadz, masjid, relawan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-low border border-surface-container-high rounded-xl pl-8 pr-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-purple-600"
            />
          </div>
        </div>

        {/* List of Sessions in Queue */}
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-on-surface-variant font-medium">Memuat data antrean...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-3 bg-surface-container-lowest border border-dashed border-surface-container-high rounded-3xl">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-[26px]">task_alt</span>
              </div>
              <div className="max-w-sm">
                <h3 className="text-sm font-bold text-on-surface">Tidak Ada Kajian di Tab Ini</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {activeTab === 'pending'
                    ? 'Alhamdulillah, semua antrean moderasi telah selesai diperiksa.'
                    : 'Tidak ada kajian yang sesuai dengan filter pencarian.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredList.map((session) => {
                const info = getEffectiveSessionInfo(session);
                const venueName = session.venues?.name || (session.is_online ? 'Kajian Online / Virtual' : 'Lokasi Terdaftar');
                const isPending = session.status === 'pending';
                const isConfirmed = session.status === 'confirmed';
                const isRejected = session.status === 'rejected';

                return (
                  <div
                    key={session.id}
                    className="bg-surface-container-lowest border border-surface-container-high/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-purple-300 transition-all flex flex-col sm:flex-row gap-4 sm:gap-5"
                  >
                    {/* Poster Thumbnail */}
                    <SessionPosterThumbnail url={session.poster_url} title={session.title} />

                    {/* Main Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        {/* Status Badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                              Menunggu Review
                            </span>
                          )}
                          {isConfirmed && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              Tayang di Peta
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-900 border border-red-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                              Ditolak Admin
                            </span>
                          )}

                          <span className="text-xs font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                            {session.speaker_name}
                          </span>

                          {session.is_recurring ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-800 bg-sky-100 border border-sky-300 px-2 py-0.5 rounded-md">
                              <span className="material-symbols-outlined text-[13px]">event_repeat</span>
                              Rutin
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md">
                              Tematik
                            </span>
                          )}

                          <span className="text-[10px] text-on-surface-variant capitalize px-1.5 py-0.5 bg-surface-container rounded">
                            {session.audience_type}
                          </span>

                          {session.is_online && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                              Online
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 px-2 py-0.5 rounded-md">
                            <span className="material-symbols-outlined text-[12px] text-teal-600">groups</span>
                            <span>{Math.max(0, (session.attendees_count || 0) + getExtraCount(session.id))} Hadir</span>
                          </span>

                          {session.is_test && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-md">
                              <span className="material-symbols-outlined text-[12px] text-amber-600">science</span>
                              <span>TEST ADMIN</span>
                            </span>
                          )}
                        </div>

                        {/* Title & Info */}
                        <h2 className="text-base sm:text-lg font-bold text-on-surface line-clamp-2">
                          {session.title}
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-on-surface-variant">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-outline">location_on</span>
                            <span className="truncate">{venueName}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-outline">schedule</span>
                            <span>{info.dateLabel}</span>
                          </div>

                          {session.book_title && session.book_title.trim() !== '' && session.book_title.toLowerCase() !== 'null' && (
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-outline">menu_book</span>
                              <span>{session.book_title}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-outline">
                              {session.contributor_name?.startsWith('@') ? 'smart_toy' : 'person_outline'}
                            </span>
                            <span>
                              Sumber:{' '}
                              {session.contributor_name?.startsWith('@') ? (
                                <span className="inline-flex items-center gap-1 text-sky-800 dark:text-sky-300 font-semibold">
                                  <span className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 text-[11px] font-mono">
                                    Scraper {session.contributor_name}
                                  </span>
                                </span>
                              ) : (
                                <strong>
                                  {session.contributor_name &&
                                  session.contributor_name.toLowerCase() !== 'null' &&
                                  session.contributor_name.trim() !== ''
                                    ? session.contributor_name
                                    : 'Anonim'}
                                </strong>
                              )}
                            </span>
                          </div>

                        </div>

                        {/* Rejection Reason (If Rejected) */}
                        {isRejected && session.rejection_reason && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 text-xs">
                            <strong>Alasan Penolakan:</strong> {session.rejection_reason}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-4 pt-3 border-t border-surface-container-high/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {session.stream_url && session.stream_url.trim() !== '' && session.stream_url.toLowerCase() !== 'null' && (
                            <a
                              href={session.stream_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">videocam</span>
                              <span>Cek Live</span>
                            </a>
                          )}
                          {session.venues?.lat && (
                            <a
                              href={`https://maps.google.com/?q=${session.venues.lat},${session.venues.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant hover:text-primary px-2.5 py-1 rounded-lg transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">map</span>
                              <span>Peta</span>
                            </a>
                          )}
                        </div>

                        {/* Moderation Controls */}
                        <div className="flex items-center gap-2 flex-wrap justify-end sm:justify-start">
                          {/* Toggle Switch Publish / Unpublish */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isConfirmed}
                            disabled={processingId === session.id}
                            onClick={() => handleTogglePublish(session.id, session.title, !isConfirmed)}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-2xs ${
                              isConfirmed
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20'
                                : 'bg-surface-container-low border-surface-container-high text-on-surface-variant hover:bg-surface-container'
                            } ${processingId === session.id ? 'opacity-50 cursor-wait' : ''}`}
                            title={isConfirmed ? 'Kajian sedang tayang di peta. Klik untuk unpublish (tarik dari peta).' : 'Kajian belum tayang di peta. Klik untuk memublikasikan.'}
                          >
                            <span
                              className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors duration-200 ease-in-out items-center px-0.5 ${
                                isConfirmed ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
                              }`}
                            >
                              <span
                                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                  isConfirmed ? 'translate-x-3' : 'translate-x-0'
                                }`}
                              />
                            </span>
                            <span>{isConfirmed ? 'Publish (Tayang)' : 'Unpublished'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingSession(session)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container border border-surface-container-high transition-all"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            <span>Edit</span>
                          </button>

                          {/* Toggle Data Testing Khusus Admin */}
                          <button
                            type="button"
                            disabled={processingId === session.id}
                            onClick={() => handleToggleTest(session.id, session.title, !!session.is_test)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
                              session.is_test
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-800 dark:text-amber-200 hover:bg-amber-500/30'
                                : 'bg-surface-container-low border-surface-container-high text-on-surface-variant hover:bg-surface-container'
                            } ${processingId === session.id ? 'opacity-50 cursor-wait' : ''}`}
                            title={session.is_test ? 'Kajian ini data test khusus admin. Klik untuk jadikan data publik biasa.' : 'Jadikan kajian ini sebagai data test (hanya tampil untuk admin).'}
                          >
                            <span className="material-symbols-outlined text-[15px] text-amber-600">science</span>
                            <span>{session.is_test ? 'Data Test' : 'Set Test'}</span>
                          </button>

                          {!isRejected && (
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingSession(session);
                                setRejectionReason('');
                              }}
                              disabled={processingId === session.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-all disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                              <span>Tolak</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal Dialog Penolakan */}
      {rejectingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-red-600">
                <span className="material-symbols-outlined text-[24px]">cancel</span>
                <h3 className="text-base font-bold text-on-surface">Tolak Kiriman Kajian</h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingSession(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant mb-4">
              Kajian: <strong>"{rejectingSession.title}"</strong> oleh {rejectingSession.speaker_name}.
            </p>

            <form onSubmit={handleRejectSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-on-surface">Alasan Penolakan <span className="text-error">*</span></span>
                <textarea
                  rows={3}
                  required
                  placeholder="Contoh: Poster kurang jelas, alamat masjid tidak akurat, atau kajian telah selesai..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full bg-surface-container-low border border-surface-container-high rounded-xl p-3 text-xs focus:outline-none focus:border-red-600"
                />
              </label>

              {/* Template Alasan Cepat */}
              <div className="flex flex-wrap gap-1 text-[11px]">
                {[
                  'Poster tidak terbaca / pecah',
                  'Titik lokasi masjid tidak sesuai',
                  'Sudah ada kajian yang sama (duplikat)',
                  'Materi / link streaming tidak valid',
                ].map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => setRejectionReason(tpl)}
                    className="px-2 py-0.5 rounded-md bg-surface-container-low hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
                  >
                    + {tpl}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setRejectingSession(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={processingId === rejectingSession.id || !rejectionReason.trim()}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  Konfirmasi Tolak
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      <EditSessionModal
        session={editingSession}
        isOpen={!!editingSession}
        onClose={() => setEditingSession(null)}
        onSuccess={() => {
          setEditingSession(null);
          loadData();
        }}
      />

      {/* AI Telegram Scraper Modal */}
      <AdminScraperModal
        isOpen={isScraperModalOpen}
        onClose={() => setIsScraperModalOpen(false)}
        channels={channels}
        onFinished={loadData}
      />
    </div>
  );
}

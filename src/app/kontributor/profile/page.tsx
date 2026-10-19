'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import type { StudySession } from '@/lib/services/kajian';
import dynamic from 'next/dynamic';
import { deleteKajian } from '@/app/actions/kajian';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { checkIsAdmin, getUserRoleAndStatus, type UserRoleInfo } from '@/lib/services/admin';
import MobileNavDrawer from '@/components/MobileNavDrawer';
import { useAttendance } from '@/utils/attendance';
import { useBookmarks } from '@/utils/bookmarks';
import RequestContributorModal from '@/components/RequestContributorModal';
import ProposeTelegramModal from '@/components/ProposeTelegramModal';
import { fetchUserTelegramChannels, type TelegramChannel } from '@/lib/services/telegram';
import {
  fetchUserStudyNotes,
  deleteStudyNote,
  formatNoteForWhatsApp,
  type StudyNote,
} from '@/utils/studyNotes';
import { useLivePlayer } from '@/context/LivePlayerContext';

const EditSessionModal = dynamic(() => import('@/components/EditSessionModal'), {
  ssr: false,
});

export default function ContributorProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleInfo, setRoleInfo] = useState<UserRoleInfo | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isProposeTelegramOpen, setIsProposeTelegramOpen] = useState(false);
  const [proposedChannels, setProposedChannels] = useState<TelegramChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'buku-saku' | 'riwayat'>('buku-saku');

  // Edit & Delete states
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { bookmarks } = useBookmarks();
  const { attending, getExtraCount } = useAttendance();
  const [showUserId, setShowUserId] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState(false);

  // Study Mode Notes State
  const { openStudyMode } = useLivePlayer();
  const [studyNotes, setStudyNotes] = useState<StudyNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const loadStudyNotes = useCallback(async (userId: string) => {
    setLoadingNotes(true);
    try {
      const data = await fetchUserStudyNotes(userId);
      setStudyNotes(data);
    } catch (e) {
      console.error('Error fetching study notes:', e);
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  const handleCopyNoteWhatsApp = async (note: StudyNote) => {
    const text = formatNoteForWhatsApp({
      title: note.title,
      speaker_name: note.speaker_name,
      channel_name: note.channel_name,
      video_id: note.video_id,
      content: note.content,
    });
    try {
      await navigator.clipboard.writeText(text);
      setToastMessage('Catatan berhasil disalin dengan format WhatsApp');
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      console.error('Gagal menyalin catatan');
    }
  };

  const handleDeleteStudyNote = async (noteId: string) => {
    if (!user?.id) return;
    if (!confirm('Apakah Anda yakin ingin menghapus catatan faidah ini?')) return;
    setDeletingNoteId(noteId);
    const ok = await deleteStudyNote(user.id, noteId);
    setDeletingNoteId(null);
    if (ok) {
      setStudyNotes((prev) => prev.filter((n) => n.id !== noteId));
      setToastMessage('Catatan berhasil dihapus');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleCopyUserId = async () => {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(user.id);
      setCopiedUserId(true);
      setTimeout(() => setCopiedUserId(false), 2000);
    } catch (err) {
      console.error('Gagal menyalin User ID:', err);
    }
  };

  const fetchUserSessions = useCallback(async (userId: string, contributorName?: string) => {
    const supabase = createClient();
    try {
      let query = supabase
        .from('study_sessions')
        .select(`
          *,
          venues (*)
        `);

      if (contributorName) {
        query = query.or(`created_by.eq.${userId},contributor_name.eq.${contributorName}`);
      } else {
        query = query.eq('created_by', userId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (!error && data) {
        setSessions(data as StudySession[]);
      } else if (error) {
        console.error('Error fetching contributor sessions:', error);
      }
    } catch (e) {
      console.error('Error fetching contributor sessions:', e);
    }
  }, []);

  const loadProposedChannels = useCallback(async (userId: string) => {
    setLoadingChannels(true);
    try {
      const data = await fetchUserTelegramChannels(userId);
      setProposedChannels(data);
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadProfile() {
      let currentUser: any = null;
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        currentUser = userData.user;
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          currentUser = sessionData.session.user;
        }
      }

      if (!mounted) return;

      if (!currentUser) {
        router.push('/login?next=/kontributor/profile');
        return;
      }

      const name =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        currentUser.email?.split('@')[0] ||
        '';

      const [adminCheck, rInfo] = await Promise.all([
        checkIsAdmin(currentUser),
        getUserRoleAndStatus(currentUser),
      ]);
      if (mounted) {
        setIsAdmin(adminCheck);
        setRoleInfo(rInfo);
      }

      setUser(currentUser);
      await Promise.all([
        fetchUserSessions(currentUser.id, name),
        loadProposedChannels(currentUser.id),
        loadStudyNotes(currentUser.id),
      ]);
      if (mounted) setLoading(false);
    }

    loadProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
      } else if (!loading) {
        router.push('/login?next=/kontributor/profile');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, loading, fetchUserSessions]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'riwayat' || tabParam === 'buku-saku') {
        setActiveTab(tabParam);
      }
      if (params.get('action') === 'request') {
        setIsRequestModalOpen(true);
      }
    }
  }, []);

  const handleTabChange = (tab: 'buku-saku' | 'riwayat') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    }
  };

  const handleDelete = async (sessionId: string, title: string) => {
    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus kajian "${title}"?`);
    if (!confirmDelete) return;

    setDeletingId(sessionId);
    try {
      const res = await deleteKajian(sessionId);
      if (res.success) {
        setToastMessage(`Kajian "${title}" berhasil dihapus.`);
        if (user) await fetchUserSessions(user.id, displayName);
      } else {
        alert(res.error || 'Gagal menghapus kajian.');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat menghapus kajian.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditSuccess = async () => {
    setToastMessage('Data kajian berhasil diperbarui!');
    if (user) await fetchUserSessions(user.id, displayName);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-3 text-on-surface">
        <div className="w-9 h-9 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs sm:text-sm text-on-surface-variant font-medium">Memuat profil relawan...</p>
      </div>
    );
  }

  if (!user) return null;

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Relawan Dakwah';
  const email = user.email || '';
  const avatarUrl = user.user_metadata?.avatar_url;

  const joinedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  const totalSessions = sessions.length;
  const onlineCount = sessions.filter((s) => s.is_online).length;
  const offlineCount = totalSessions - onlineCount;
  const totalAttendeesCount = sessions.reduce(
    (acc, s) => acc + Math.max(0, (s.attendees_count || 0) + getExtraCount(s.id)),
    0
  );
  const isContributorOrAdmin = isAdmin || roleInfo?.role === 'kontributor';

  const renderTelegramSection = () => (
    <div className="bg-surface-container-lowest border border-surface-container-high/70 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold shrink-0">
            <span className="material-symbols-outlined text-[20px]">send</span>
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-on-surface">Usulan Channel Telegram</h2>
            <p className="text-[11px] text-outline">Sumber info kajian yang Anda bantu usulkan untuk bot AI Scraper</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsProposeTelegramOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800 transition-colors cursor-pointer self-start sm:self-center active:scale-95"
        >
          <span className="material-symbols-outlined text-[16px]">add_circle</span>
          <span>Usulkan Channel Baru</span>
        </button>
      </div>

      {loadingChannels ? (
        <div className="py-6 text-center text-outline text-xs flex items-center justify-center gap-2">
          <span className="material-symbols-outlined animate-spin text-[16px] text-sky-600">progress_activity</span>
          <span>Memuat usulan channel...</span>
        </div>
      ) : proposedChannels.length === 0 ? (
        <div className="py-6 px-4 rounded-2xl bg-surface-container/40 border border-surface-container-high/60 text-center space-y-1.5">
          <p className="text-xs font-semibold text-on-surface">Belum ada channel Telegram yang diusulkan</p>
          <p className="text-[11px] text-outline max-w-md mx-auto">
            Punya rekomendasi channel Telegram publik yang sering membagikan info kajian? Usulkan agar bot AI kami dapat memantau dan mempublikasikannya secara otomatis!
          </p>
        </div>
      ) : (
        <div className="divide-y divide-surface-container-high/50 rounded-2xl border border-surface-container-high/70 overflow-hidden">
          {proposedChannels.map((ch) => (
            <div key={ch.id} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container/20">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-on-surface">{ch.channel_title}</span>
                  {ch.status === 'pending' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300">
                      <span className="material-symbols-outlined text-[11px]">hourglass_top</span>
                      Menunggu Review
                    </span>
                  )}
                  {ch.status === 'approved' && ch.is_active && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-300">
                      <span className="material-symbols-outlined text-[11px]">check_circle</span>
                      Aktif Dipantau
                    </span>
                  )}
                  {ch.status === 'approved' && !ch.is_active && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-300">
                      <span className="material-symbols-outlined text-[11px]">pause</span>
                      Dijeda Sementara
                    </span>
                  )}
                  {ch.status === 'rejected' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border border-rose-300">
                      <span className="material-symbols-outlined text-[11px]">close</span>
                      Ditolak
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-outline">
                  <a
                    href={`https://t.me/s/${ch.channel_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-600 dark:text-sky-400 hover:underline font-medium inline-flex items-center gap-0.5"
                  >
                    <span>@{ch.channel_username}</span>
                    <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                  </a>
                  {ch.city && (
                    <>
                      <span>•</span>
                      <span>{ch.city}</span>
                    </>
                  )}
                </div>

                {ch.rejection_reason && (
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">
                    <strong>Catatan Admin:</strong> {ch.rejection_reason}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface font-geist text-on-surface flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container-high/60 shadow-xs">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1 sm:gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors py-1.5 px-2 rounded-lg hover:bg-surface-container shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span className="hidden sm:inline">Ke Leaderboard</span>
            <span className="sm:hidden text-[11px]">Peringkat</span>
          </Link>

          {/* Desktop Actions */}
          <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/50 hover:bg-amber-200 dark:hover:bg-amber-900/60 dark:hover:text-amber-100 border border-amber-300 dark:border-amber-700/60 px-2 sm:px-3 py-1.5 rounded-full transition-colors shadow-2xs"
              >
                <span className="material-symbols-outlined text-[15px] sm:text-[16px]">admin_panel_settings</span>
                <span>Portal Admin</span>
              </Link>
            )}
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-on-surface-variant hover:text-primary px-2.5 sm:px-3 py-1.5 rounded-full hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">map</span>
              <span>Peta</span>
            </Link>
            {isAdmin || roleInfo?.role === 'kontributor' ? (
              <Link
                href="/kontributor/dashboard"
                className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-white bg-primary hover:bg-primary/90 px-3 sm:px-3.5 py-1.5 rounded-full shadow-sm transition-colors whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[15px] sm:text-[16px]">add_circle</span>
                <span>Kirim Kajian</span>
              </Link>
            ) : roleInfo?.requestStatus === 'pending' ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-full whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Menunggu Review</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 sm:px-3.5 py-1.5 rounded-full shadow-sm transition-colors whitespace-nowrap cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[15px] sm:text-[16px]">volunteer_activism</span>
                <span>Ajukan Kontributor</span>
              </button>
            )}
          </div>

          {/* Mobile Single Hamburger Button */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="sm:hidden w-8 h-8 rounded-lg bg-surface-container border border-surface-container-high flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer active:scale-95"
            aria-label="Buka Menu Navigasi"
          >
            <span className="material-symbols-outlined text-[20px]">menu</span>
          </button>
        </div>
      </header>

      {/* Slide-over Mobile Sidebar Drawer */}
      <MobileNavDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentUser={{
          name: user?.user_metadata?.full_name,
          email: user?.email,
          avatarUrl: avatarUrl,
          role: roleInfo?.role,
        }}
        isAdmin={isAdmin}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-3 sm:px-4 py-5 sm:py-8 flex flex-col gap-5 sm:gap-6">
        {/* Toast Notifikasi */}
        {toastMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-emerald-800 dark:text-emerald-300 hover:opacity-75"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* User Profile Card */}
        <div className="bg-surface-container-lowest border border-surface-container-high/70 rounded-3xl p-5 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

          {/* Avatar */}
          <div className="relative shrink-0">
            {avatarUrl && !avatarError ? (
              <img
                src={avatarUrl}
                alt={displayName}
                onError={() => setAvatarError(true)}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-primary/20 shadow-md"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-2xl sm:text-3xl ring-4 ring-primary/20 shadow-md select-none uppercase">
                {displayName ? displayName.slice(0, 2).toUpperCase() : 'U'}
              </div>
            )}
            <span
              className={`absolute bottom-0 right-0 w-7 h-7 sm:w-8 sm:h-8 aspect-square rounded-full flex items-center justify-center shadow-md border-2 border-surface-container-lowest shrink-0 ${
                isAdmin ? 'bg-amber-600 text-white' : roleInfo?.role === 'kontributor' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
              }`}
              title={isAdmin ? 'Administrator' : roleInfo?.role === 'kontributor' ? 'Relawan Terverifikasi' : 'Jamaah (User)'}
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[17px] leading-none select-none font-bold">
                {isAdmin ? 'shield_person' : roleInfo?.role === 'kontributor' ? 'check' : 'person'}
              </span>
            </span>
          </div>

          {/* Info & Meta */}
          <div className="flex-1 min-w-0 w-full">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
              <h1 className="text-xl sm:text-2xl font-bold text-on-surface truncate">
                {displayName}
              </h1>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60">
                  <span className="material-symbols-outlined text-[13px] text-amber-700 dark:text-amber-400">shield_person</span>
                  Administrator
                </span>
              ) : roleInfo?.role === 'kontributor' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/60">
                  <span className="material-symbols-outlined text-[12px]">verified_user</span>
                  Relawan Terverifikasi
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700/60">
                  <span className="material-symbols-outlined text-[13px] text-blue-600 dark:text-blue-400">person</span>
                  Jamaah (User)
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-on-surface-variant break-all mb-1.5">
              {email}
            </p>

            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px] text-outline font-mono mb-3 flex-wrap">
              <span className="font-sans text-outline/80 leading-none">User ID:</span>
              <span
                onClick={() => setShowUserId((prev) => !prev)}
                className={`inline-flex items-center h-5 px-1.5 rounded border border-surface-container-high cursor-pointer select-all max-w-[170px] sm:max-w-none truncate transition-colors leading-none ${
                  showUserId
                    ? 'bg-surface-container text-on-surface font-medium text-[11px]'
                    : 'bg-surface-container-low text-outline hover:text-on-surface tracking-widest text-[10px]'
                }`}
                title={showUserId ? user?.id : "Klik untuk menampilkan / menyembunyikan User ID"}
              >
                {showUserId ? user?.id : '••••••••••••'}
              </span>

              {/* Eye toggle button */}
              <button
                type="button"
                onClick={() => setShowUserId((prev) => !prev)}
                className="w-5 h-5 inline-flex items-center justify-center rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors active:scale-90"
                title={showUserId ? "Sembunyikan User ID" : "Tampilkan User ID"}
                aria-label={showUserId ? "Sembunyikan User ID" : "Tampilkan User ID"}
              >
                <span className="material-symbols-outlined text-[12px] leading-none select-none">
                  {showUserId ? 'visibility_off' : 'visibility'}
                </span>
              </button>

              {/* Copy button */}
              <button
                type="button"
                onClick={handleCopyUserId}
                className={`w-5 h-5 inline-flex items-center justify-center rounded transition-colors active:scale-90 ${
                  copiedUserId
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60'
                    : 'text-outline hover:text-primary hover:bg-surface-container'
                }`}
                title={copiedUserId ? "Berhasil disalin!" : "Salin User ID"}
                aria-label="Salin User ID"
              >
                <span className="material-symbols-outlined text-[12px] leading-none select-none">
                  {copiedUserId ? 'check' : 'content_copy'}
                </span>
              </button>

              {copiedUserId && (
                <span className="font-sans text-[10px] text-emerald-600 dark:text-emerald-400 font-medium leading-none animate-fadeIn select-none">
                  Tersalin!
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4 text-xs text-outline">
              {joinedDate && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">calendar_month</span>
                  Bergabung {joinedDate}
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">favorite</span>
                Fastabiqul Khairat
              </span>
            </div>
          </div>

          {/* Sign Out Button */}
          <div className="shrink-0 pt-1 w-full sm:w-auto flex justify-center sm:justify-end">
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-error bg-error/10 hover:bg-error/20 transition-colors active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                Keluar
              </button>
            </form>
          </div>
        </div>

        {/* Banner Status Permohonan (Pending / Rejected) Khusus Role 'user' */}
        {!isAdmin && roleInfo?.role !== 'kontributor' && (roleInfo?.requestStatus === 'pending' || roleInfo?.requestStatus === 'rejected') && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            {roleInfo?.requestStatus === 'pending' ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">hourglass_top</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm">Permohonan Relawan Sedang Ditinjau Admin</p>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                      {roleInfo.communityName ? `Masjid/Majelis: ${roleInfo.communityName}` : 'Permohonan Anda telah diterima.'} Admin akan segera memverifikasi akun Anda agar dapat mempublikasikan jadwal kajian.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 px-3 py-1 rounded-full uppercase tracking-wider shrink-0 self-start sm:self-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Menunggu Kurasi
                </span>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-200">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">info</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm">Permohonan Relawan Belum Disetujui</p>
                    <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80 mt-0.5">
                      {roleInfo.requestNote ? `Catatan Admin: ${roleInfo.requestNote}` : 'Anda dapat memperbarui data komunitas dan mengajukan kembali permohonan kontributor.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shrink-0 shadow-2xs active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  <span>Ajukan Ulang</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab Switcher: Buku Saku vs Riwayat */}
        <div className="flex items-center justify-center w-full">
          <div className="grid grid-cols-2 p-1 sm:p-1.5 bg-surface-container-low rounded-2xl border border-surface-container-high/70 shadow-xs max-w-md w-full">
            <button
              type="button"
              onClick={() => handleTabChange('buku-saku')}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'buku-saku'
                  ? 'bg-surface-container-lowest text-emerald-700 dark:text-emerald-400 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] sm:text-[20px] shrink-0">auto_stories</span>
              <span className="truncate">Buku Saku</span>
              <span
                className={`text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold transition-colors shrink-0 ${
                  activeTab === 'buku-saku'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : 'bg-surface-container text-outline'
                }`}
              >
                {studyNotes.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('riwayat')}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'riwayat'
                  ? 'bg-surface-container-lowest text-primary dark:text-emerald-400 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] sm:text-[20px] shrink-0">history_edu</span>
              <span className="truncate">Riwayat</span>
              <span
                className={`text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold transition-colors shrink-0 ${
                  activeTab === 'riwayat'
                    ? 'bg-primary/15 text-primary dark:text-emerald-400'
                    : 'bg-surface-container text-outline'
                }`}
              >
                {isContributorOrAdmin ? sessions.length : bookmarks.length + attending.length}
              </span>
            </button>
          </div>
        </div>

        {/* ================= TAB 1: BUKU SAKU FAIDAH ================= */}
        {activeTab === 'buku-saku' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1.5 xs:gap-3">
              <h2 className="text-sm sm:text-base font-bold text-on-surface flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[20px] sm:text-[22px] shrink-0">auto_stories</span>
                <span>Buku Saku Faidah</span>
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 shrink-0">
                  {studyNotes.length}
                </span>
              </h2>
              <Link
                href="/live"
                className="text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 whitespace-nowrap self-start xs:self-auto shrink-0"
              >
                <span className="hidden sm:inline">Mencatat dari Siaran Live</span>
                <span className="sm:hidden inline">Dari Siaran Live</span>
                <span className="material-symbols-outlined text-[13px] sm:text-[14px]">arrow_forward</span>
              </Link>
            </div>

            {loadingNotes ? (
              <div className="p-8 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 text-center animate-pulse text-xs text-outline">
                Memuat catatan faidah Anda...
              </div>
            ) : studyNotes.length === 0 ? (
              <div className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-surface-container-high/70 text-center shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-[28px]">edit_note</span>
                </div>
                <h3 className="text-sm font-bold text-on-surface">Belum Ada Catatan Kajian</h3>
                <p className="text-xs text-outline mt-1.5 max-w-sm mx-auto leading-relaxed">
                  Ikat faidah penting dengan menuliskannya. Buka siaran live atau rekaman kajian di peta, lalu tekan tombol <strong>&ldquo;Mode Belajar&rdquo;</strong> untuk mulai mencatat.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Link
                    href="/live"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-all shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">live_tv</span>
                    <span>Siaran Live</span>
                  </Link>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">map</span>
                    <span>Peta Kajian</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {studyNotes.map((note) => {
                  const noteDate = note.updated_at
                    ? new Date(note.updated_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '';

                  return (
                    <div
                      key={note.id || note.video_id}
                      className="p-4 sm:p-5 rounded-3xl bg-surface-container-lowest border border-surface-container-high/70 shadow-xs hover:border-emerald-500/40 transition-all flex flex-col justify-between gap-3 group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60">
                            Catatan Faidah
                          </span>
                          {noteDate && (
                            <span className="text-[11px] text-outline font-medium">
                              {noteDate}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-on-surface line-clamp-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                          {note.title}
                        </h3>

                        {note.speaker_name && (
                          <p className="text-[11px] text-outline truncate mt-0.5">
                            {note.speaker_name}
                          </p>
                        )}

                        {/* Snippet Preview */}
                        <p className="text-xs text-on-surface-variant font-mono bg-surface-container-low/50 dark:bg-neutral-800/40 p-2.5 rounded-xl border border-surface-container-high/40 line-clamp-3 mt-2.5 whitespace-pre-line leading-relaxed">
                          {note.content || '(Catatan masih kosong)'}
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-surface-container-high/50 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              openStudyMode({
                                videoId: note.video_id,
                                title: note.title,
                                speakerName: note.speaker_name || undefined,
                                channelName: note.channel_name || undefined,
                                sessionId: note.session_id || undefined,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer text-xs"
                            title="Buka kembali Mode Belajar untuk membaca & menyimak video"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit_note</span>
                            <span>Buka Catatan</span>
                          </button>

                          <a
                            href={`https://youtu.be/${note.video_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-surface-container-high/80 hover:bg-surface-container text-outline hover:text-red-600 transition-colors text-xs font-semibold"
                            title="Tonton Ulang Rekaman di YouTube"
                          >
                            <span className="material-symbols-outlined text-[15px] text-red-600">smart_display</span>
                            <span className="hidden sm:inline">YouTube</span>
                            <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                          </a>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyNoteWhatsApp(note)}
                            className="p-1.5 rounded-xl text-outline hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                            title="Salin Format WhatsApp"
                          >
                            <span className="material-symbols-outlined text-[17px]">share</span>
                          </button>

                          <button
                            type="button"
                            disabled={deletingNoteId === note.id}
                            onClick={() => note.id && handleDeleteStudyNote(note.id)}
                            className="p-1.5 rounded-xl text-outline hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer disabled:opacity-50"
                            title="Hapus Catatan"
                          >
                            <span className="material-symbols-outlined text-[17px]">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: RIWAYAT ================= */}
        {activeTab === 'riwayat' && (
          <div className="flex flex-col gap-5 sm:gap-6 animate-in fade-in duration-300">
            {!isContributorOrAdmin ? (
              <>
                {/* Aktivitas Jamaah (Jadwal Tersimpan & RSVP Kehadiran) - Khusus Role 'user' */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1.5 xs:gap-3">
                    <h2 className="text-sm sm:text-base font-bold text-on-surface flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
                      <span className="material-symbols-outlined text-primary text-[20px] sm:text-[22px] shrink-0">event_upcoming</span>
                      <span>Aktivitas & Riwayat Saya</span>
                    </h2>
                    <Link
                      href="/"
                      className="text-[11px] sm:text-xs font-semibold text-primary hover:underline flex items-center gap-1 whitespace-nowrap self-start xs:self-auto shrink-0"
                    >
                      <span>Buka di Peta</span>
                      <span className="material-symbols-outlined text-[13px] sm:text-[14px]">arrow_forward</span>
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    {/* Card Bookmark */}
                    <Link
                      href="/"
                      className="p-4 sm:p-5 rounded-3xl bg-surface-container-lowest border border-surface-container-high/70 shadow-xs flex items-center justify-between gap-3 hover:border-primary/40 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <span className="material-symbols-outlined text-[22px]">bookmark</span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs sm:text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors">Jadwal Tersimpan</h3>
                          <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                            Buka di peta
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xl sm:text-2xl font-black text-primary">{bookmarks.length}</span>
                        <span className="block text-[10px] text-outline font-medium">Kajian &rarr;</span>
                      </div>
                    </Link>

                    {/* Card RSVP / Hadir */}
                    <div className="p-4 sm:p-5 rounded-3xl bg-surface-container-lowest border border-surface-container-high/70 shadow-xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[22px]">how_to_reg</span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs sm:text-sm font-bold text-on-surface truncate">Kehadiran Saya</h3>
                          <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                            Jejak majelis hadir
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{attending.length}</span>
                        <span className="block text-[10px] text-outline font-medium">Kajian</span>
                      </div>
                    </div>

                    {/* Card Buku Saku Faidah */}
                    <button
                      type="button"
                      onClick={() => handleTabChange('buku-saku')}
                      className="p-4 sm:p-5 rounded-3xl bg-surface-container-lowest border border-surface-container-high/70 shadow-xs flex items-center justify-between gap-3 text-left hover:border-emerald-500/40 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <span className="material-symbols-outlined text-[22px]">auto_stories</span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs sm:text-sm font-bold text-on-surface truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Buku Saku Faidah</h3>
                          <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                            Lihat {studyNotes.length} catatan kajian
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xl sm:text-2xl font-black text-teal-600 dark:text-teal-400">{studyNotes.length}</span>
                        <span className="block text-[10px] text-outline font-medium">Catatan &rarr;</span>
                      </div>
                    </button>
                  </div>

                  {/* Info Panduan Jamaah */}
                  <div className="p-4 rounded-2xl bg-surface-container-low/60 border border-surface-container-high/60 text-xs text-on-surface-variant flex items-start gap-3">
                    <span className="material-symbols-outlined text-outline text-[20px] shrink-0 mt-0.5">lightbulb</span>
                    <p className="leading-relaxed">
                      Anda dapat menjelajahi peta untuk mencari majelis ilmu di sekitar Anda, menyimpan kajian pilihan, dan menekan tombol <strong>&quot;Saya Hadir&quot;</strong> agar penyelenggara dapat mengestimasi jumlah jamaah.
                    </p>
                  </div>
                </div>

                {/* Usulan Channel Telegram */}
                {renderTelegramSection()}

                {/* Banner Ajakan Bergabung Kontributor Dakwah (jika status normal) */}
                {(!roleInfo?.requestStatus || (roleInfo.requestStatus !== 'pending' && roleInfo.requestStatus !== 'rejected')) && (
                  <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-primary/10 border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs shadow-xs">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <span className="material-symbols-outlined text-[22px]">volunteer_activism</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">Mari Bergabung Menjadi Relawan Dakwah</p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed max-w-xl">
                          Ingin mempublikasikan jadwal kajian dari masjid atau majelis taklim di daerah Anda ke peta seluruh Indonesia? Ajukan diri sekarang agar akun Anda diverifikasi oleh Admin.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRequestModalOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm shrink-0 active:scale-95 cursor-pointer whitespace-nowrap"
                    >
                      <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                      <span>Ajukan Jadi Kontributor</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Contribution Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                  <div className="bg-surface-container-lowest border border-surface-container-high/70 rounded-2xl p-2.5 sm:p-4 text-center shadow-sm">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-1">
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]">mosque</span>
                    </div>
                    <p className="text-lg sm:text-2xl font-black text-on-surface">{totalSessions}</p>
                    <p className="text-[10px] sm:text-xs text-on-surface-variant font-medium mt-0.5 leading-tight">Total Kontribusi</p>
                  </div>

                  <div className="bg-surface-container-lowest border border-surface-container-high/70 rounded-2xl p-2.5 sm:p-4 text-center shadow-sm">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 mx-auto flex items-center justify-center mb-1">
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]">pin_drop</span>
                    </div>
                    <p className="text-lg sm:text-2xl font-black text-emerald-800 dark:text-emerald-300">{offlineCount}</p>
                    <p className="text-[10px] sm:text-xs text-on-surface-variant font-medium mt-0.5 leading-tight">Kajian Masjid</p>
                  </div>

                  <div className="bg-surface-container-lowest border border-surface-container-high/70 rounded-2xl p-2.5 sm:p-4 text-center shadow-sm">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 mx-auto flex items-center justify-center mb-1">
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]">podcasts</span>
                    </div>
                    <p className="text-lg sm:text-2xl font-black text-blue-800 dark:text-blue-300">{onlineCount}</p>
                    <p className="text-[10px] sm:text-xs text-on-surface-variant font-medium mt-0.5 leading-tight">Kajian Online</p>
                  </div>

                  <div className="bg-surface-container-lowest border border-surface-container-high/70 rounded-2xl p-2.5 sm:p-4 text-center shadow-sm">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 mx-auto flex items-center justify-center mb-1">
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]">groups</span>
                    </div>
                    <p className="text-lg sm:text-2xl font-black text-amber-800 dark:text-amber-300">{totalAttendeesCount}</p>
                    <p className="text-[10px] sm:text-xs text-on-surface-variant font-medium mt-0.5 leading-tight">Jamaah Hadir</p>
                  </div>
                </div>

                {/* List of Submitted Kajian */}
                <div className="flex flex-col gap-3.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">history_edu</span>
                      Riwayat Kajian yang Saya Kirim
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!user) return;
                          setIsRefreshing(true);
                          await fetchUserSessions(user.id, displayName);
                          setIsRefreshing(false);
                        }}
                        disabled={isRefreshing}
                        className="p-1 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface transition-colors flex items-center justify-center disabled:opacity-50 cursor-pointer"
                        title="Segarkan Riwayat"
                      >
                        <span className={`material-symbols-outlined text-[18px] ${isRefreshing ? 'animate-spin text-primary' : ''}`}>
                          refresh
                        </span>
                      </button>
                      <span className="text-xs text-outline font-medium">
                        {sessions.length} jadwal
                      </span>
                    </div>
                  </div>

                  {sessions.length === 0 ? (
                    <div className="p-8 sm:p-12 text-center flex flex-col items-center gap-3.5 bg-surface-container-lowest border border-dashed border-surface-container-high rounded-3xl">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/60">
                        <span className="material-symbols-outlined text-[28px]">post_add</span>
                      </div>
                      <div className="max-w-sm">
                        <h3 className="text-sm font-bold text-on-surface">Belum Ada Kajian yang Diinput</h3>
                        <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                          Mari menjadi bagian dari syiar dakwah dengan mengirimkan informasi jadwal kajian dari masjid di sekitar Anda.
                        </p>
                      </div>
                      {!isAdmin && roleInfo?.role !== 'kontributor' ? (
                        <button
                          type="button"
                          onClick={() => setIsRequestModalOpen(true)}
                          className="mt-1 px-5 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-sm hover:bg-emerald-700 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[16px]">volunteer_activism</span>
                          <span>Ajukan Jadi Kontributor Dakwah</span>
                        </button>
                      ) : (
                        <Link
                          href="/kontributor/dashboard"
                          className="mt-1 px-5 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl shadow-sm hover:bg-primary/90 transition-all flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px]">add_circle</span>
                          <span>Kirim Kajian Pertama Saya</span>
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-surface-container-high/60 border border-surface-container-high/60 rounded-2xl overflow-hidden bg-surface-container-lowest shadow-sm">
                      {sessions.map((s) => {
                        const venueName = s.venues?.name || (s.is_online ? 'Kajian Online / Live Streaming' : 'Lokasi Terdaftar');
                        const info = getEffectiveSessionInfo(s);

                        const isStatusCanceled = s.status === 'canceled';
                        const isStatusPostponed = s.status === 'postponed';
                        const attendeesCount = Math.max(0, (s.attendees_count || 0) + getExtraCount(s.id));

                        return (
                          <div key={s.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-container-low/40 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-xs font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                                  {s.speaker_name}
                                </span>

                                {s.is_recurring ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-800 bg-sky-100 border border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60 px-2 py-0.5 rounded-md">
                                    <span className="material-symbols-outlined text-[13px]">event_repeat</span>
                                    Rutin Pekanan
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium text-slate-700 bg-slate-100 border border-slate-300 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700 px-2 py-0.5 rounded-md">
                                    Tematik
                                  </span>
                                )}

                                {s.is_online && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60 px-2 py-0.5 rounded-md">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                                    Online
                                  </span>
                                )}

                                {s.status === 'pending' ? (
                                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60 px-2 py-0.5 rounded-md">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    Menunggu Review Admin
                                  </span>
                                ) : s.status === 'rejected' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60 px-2 py-0.5 rounded-md">
                                    <span className="material-symbols-outlined text-[13px] text-rose-600 dark:text-rose-400">cancel</span>
                                    Ditolak Admin
                                  </span>
                                ) : isStatusCanceled ? (
                                  <span className="text-[11px] font-bold text-red-700 bg-red-100 border border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/60 px-2 py-0.5 rounded-md">
                                    Dibatalkan
                                  </span>
                                ) : isStatusPostponed ? (
                                  <span className="text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60 px-2 py-0.5 rounded-md">
                                    Ditunda
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                    Tayang di Peta
                                  </span>
                                )}

                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 px-2 py-0.5 rounded-md">
                                  <span className="material-symbols-outlined text-[13px] text-teal-600">groups</span>
                                  <span>{attendeesCount} Jamaah Hadir</span>
                                </span>
                              </div>

                              <h3 className="text-sm sm:text-base font-bold text-on-surface line-clamp-1">
                                {s.title}
                              </h3>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-on-surface-variant">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[15px] text-outline">location_on</span>
                                  <span className="truncate max-w-[200px] sm:max-w-none">{venueName}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[15px] text-outline">schedule</span>
                                  <span>{info.dateLabel}</span>
                                </span>
                                {s.book_title && s.book_title.trim() !== '' && s.book_title.toLowerCase() !== 'null' && (
                                  <span className="flex items-center gap-1 text-outline">
                                    <span className="material-symbols-outlined text-[15px]">menu_book</span>
                                    <span>{s.book_title}</span>
                                  </span>
                                )}
                              </div>

                              {s.status === 'rejected' && s.rejection_reason && (
                                <div className="mt-2.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2">
                                  <span className="material-symbols-outlined text-[16px] text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">info</span>
                                  <div>
                                    <span className="font-semibold">Catatan Review Admin: </span>
                                    <span>{s.rejection_reason}</span>
                                    <p className="text-[11px] text-rose-700/80 dark:text-rose-400/80 mt-0.5">
                                      Silakan klik tombol <b>Edit</b> untuk merevisi data kajian Anda.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Action Buttons (Edit & Delete) */}
                            <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-center justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-container-high/40">
                              <button
                                type="button"
                                onClick={() => setEditingSession(s)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all active:scale-95 shadow-2xs cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDelete(s.id, s.title)}
                                disabled={deletingId === s.id}
                                className="inline-flex items-center justify-center p-2 rounded-xl text-xs font-semibold text-error bg-error/10 hover:bg-error/20 border border-error/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                title="Hapus Kajian"
                              >
                                {deletingId === s.id ? (
                                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                                ) : (
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Usulan Channel Telegram */}
                {renderTelegramSection()}
              </>
            )}
          </div>
        )}
      </main>

      {/* Edit Session Modal */}
      <EditSessionModal
        session={editingSession}
        isOpen={!!editingSession}
        onClose={() => setEditingSession(null)}
        onSuccess={handleEditSuccess}
      />

      {/* Modal Pengajuan Relawan Kontributor Dakwah */}
      <RequestContributorModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSuccess={async () => {
          setToastMessage('Permohonan relawan kontributor berhasil dikirim! Menunggu verifikasi dari Admin.');
          if (user) {
            const rInfo = await getUserRoleAndStatus(user);
            setRoleInfo(rInfo);
          }
        }}
        userEmail={email}
      />

      {/* Modal Usulan Channel Telegram */}
      <ProposeTelegramModal
        isOpen={isProposeTelegramOpen}
        onClose={() => setIsProposeTelegramOpen(false)}
        onSuccess={() => {
          setToastMessage('Usulan channel Telegram berhasil dikirim! Menunggu verifikasi Admin.');
          if (user?.id) {
            loadProposedChannels(user.id);
          }
        }}
      />
    </div>
  );
}

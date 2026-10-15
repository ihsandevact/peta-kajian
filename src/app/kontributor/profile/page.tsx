'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import type { StudySession } from '@/lib/services/kajian';
import dynamic from 'next/dynamic';
import { deleteKajian } from '@/app/actions/kajian';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { checkIsAdmin } from '@/lib/services/admin';
import MobileNavDrawer from '@/components/MobileNavDrawer';

const EditSessionModal = dynamic(() => import('@/components/EditSessionModal'), {
  ssr: false,
});

export default function ContributorProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit & Delete states
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
        router.push('/kontributor/login');
        return;
      }

      const name =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        currentUser.email?.split('@')[0] ||
        '';

      const adminCheck = await checkIsAdmin(currentUser);
      if (mounted) setIsAdmin(adminCheck);

      setUser(currentUser);
      await fetchUserSessions(currentUser.id, name);
      if (mounted) setLoading(false);
    }

    loadProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
      } else if (!loading) {
        router.push('/kontributor/login');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, loading, fetchUserSessions]);

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
                className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/40 hover:bg-amber-200 border border-amber-300 dark:border-amber-800 px-2 sm:px-3 py-1.5 rounded-full transition-colors shadow-2xs"
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
            <Link
              href="/kontributor/dashboard"
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-white bg-primary hover:bg-primary/90 px-3 sm:px-3.5 py-1.5 rounded-full shadow-sm transition-colors whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">add_circle</span>
              <span>Kirim Kajian</span>
            </Link>
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
                isAdmin ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'
              }`}
              title={isAdmin ? 'Administrator' : 'Relawan Terverifikasi'}
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[17px] leading-none select-none font-bold">
                {isAdmin ? 'shield_person' : 'check'}
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
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  <span className="material-symbols-outlined text-[13px] text-amber-700">shield_person</span>
                  Administrator
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="material-symbols-outlined text-[12px]">verified_user</span>
                  Relawan Terverifikasi
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-on-surface-variant break-all mb-1.5">
              {email}
            </p>

            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px] text-outline font-mono mb-3 flex-wrap">
              <span>User ID:</span>
              <span className="bg-surface-container px-2 py-0.5 rounded font-medium text-on-surface select-all cursor-pointer border border-surface-container-high max-w-[200px] sm:max-w-none truncate" title="User ID akun aktif Anda">
                {user.id}
              </span>
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

        {/* Contribution Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-surface-container-lowest border border-surface-container-high/70 rounded-2xl p-2.5 sm:p-4 text-center shadow-sm">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-1">
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">mosque</span>
            </div>
            <p className="text-lg sm:text-2xl font-black text-on-surface">{totalSessions}</p>
            <p className="text-[10px] sm:text-xs text-on-surface-variant font-medium mt-0.5 leading-tight">Total Kontribusi</p>
          </div>

          <div className="bg-surface-container-lowest border border-surface-container-high/70 rounded-2xl p-2.5 sm:p-4 text-center shadow-sm">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-1">
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">pin_drop</span>
            </div>
            <p className="text-lg sm:text-2xl font-black text-emerald-800">{offlineCount}</p>
            <p className="text-[10px] sm:text-xs text-on-surface-variant font-medium mt-0.5 leading-tight">Kajian Masjid</p>
          </div>

          <div className="bg-surface-container-lowest border border-surface-container-high/70 rounded-2xl p-2.5 sm:p-4 text-center shadow-sm">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-100 text-blue-700 mx-auto flex items-center justify-center mb-1">
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">podcasts</span>
            </div>
            <p className="text-lg sm:text-2xl font-black text-blue-800">{onlineCount}</p>
            <p className="text-[10px] sm:text-xs text-on-surface-variant font-medium mt-0.5 leading-tight">Kajian Online</p>
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
                onClick={() => fetchUserSessions(user.id, displayName)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface transition-colors flex items-center justify-center"
                title="Segarkan Riwayat"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
              </button>
              <span className="text-xs text-outline font-medium">
                {sessions.length} jadwal
              </span>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="p-8 sm:p-12 text-center flex flex-col items-center gap-3.5 bg-surface-container-lowest border border-dashed border-surface-container-high rounded-3xl">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                <span className="material-symbols-outlined text-[28px]">post_add</span>
              </div>
              <div className="max-w-sm">
                <h3 className="text-sm font-bold text-on-surface">Belum Ada Kajian yang Diinput</h3>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Mari menjadi bagian dari syiar dakwah dengan mengirimkan informasi jadwal kajian dari masjid di sekitar Anda.
                </p>
              </div>
              <Link
                href="/kontributor/dashboard"
                className="mt-1 px-5 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl shadow-sm hover:bg-primary/90 transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                Kirim Kajian Pertama Saya
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-surface-container-high/60 border border-surface-container-high/60 rounded-2xl overflow-hidden bg-surface-container-lowest shadow-sm">
              {sessions.map((s) => {
                const venueName = s.venues?.name || (s.is_online ? 'Kajian Online / Live Streaming' : 'Lokasi Terdaftar');
                const info = getEffectiveSessionInfo(s);

                const isStatusCanceled = s.status === 'canceled';
                const isStatusPostponed = s.status === 'postponed';

                return (
                  <div key={s.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-container-low/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                          {s.speaker_name}
                        </span>

                        {s.is_recurring ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-800 bg-sky-100 border border-sky-300 px-2 py-0.5 rounded-md">
                            <span className="material-symbols-outlined text-[13px]">event_repeat</span>
                            Rutin Pekanan
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md">
                            Tematik
                          </span>
                        )}

                        {s.is_online && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                            Online
                          </span>
                        )}

                        {s.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Menunggu Review Admin
                          </span>
                        ) : s.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded-md">
                            <span className="material-symbols-outlined text-[13px] text-rose-600">cancel</span>
                            Ditolak Admin
                          </span>
                        ) : isStatusCanceled ? (
                          <span className="text-[11px] font-bold text-red-700 bg-red-100 border border-red-300 px-2 py-0.5 rounded-md">
                            Dibatalkan
                          </span>
                        ) : isStatusPostponed ? (
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                            Ditunda
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Tayang di Peta
                          </span>
                        )}
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
                          <span className="material-symbols-outlined text-[16px] text-rose-600 shrink-0 mt-0.5">info</span>
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all active:scale-95 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(s.id, s.title)}
                        disabled={deletingId === s.id}
                        className="inline-flex items-center justify-center p-2 rounded-xl text-xs font-semibold text-error bg-error/10 hover:bg-error/20 border border-error/20 transition-all active:scale-95 disabled:opacity-50"
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
      </main>

      {/* Edit Session Modal */}
      <EditSessionModal
        session={editingSession}
        isOpen={!!editingSession}
        onClose={() => setEditingSession(null)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}

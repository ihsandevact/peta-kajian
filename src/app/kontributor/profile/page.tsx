'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import type { StudySession } from '@/lib/services/kajian';

export default function ContributorProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadProfile() {
      // 1. Dapatkan user aktif
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

      setUser(currentUser);

      // 2. Ambil riwayat kajian yang diinput oleh user ini
      try {
        const { data: userSessions, error } = await supabase
          .from('study_sessions')
          .select(`
            *,
            venues (*)
          `)
          .eq('created_by', currentUser.id)
          .order('created_at', { ascending: false });

        if (!error && userSessions) {
          setSessions(userSessions as StudySession[]);
        }
      } catch (e) {
        console.error('Error fetching contributor sessions:', e);
      } finally {
        if (mounted) setLoading(false);
      }
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
  }, [router, loading]);

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
      <header className="sticky top-0 z-40 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container-high/60">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors py-1.5 px-2.5 rounded-lg hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Ke Leaderboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary px-3 py-1.5 rounded-full hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">map</span>
              <span>Peta</span>
            </Link>
            <Link
              href="/kontributor/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 px-3.5 py-1.5 rounded-full shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>Kirim Kajian</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 sm:py-8 flex flex-col gap-6">
        {/* User Profile Card */}
        <div className="bg-surface-container-lowest border border-surface-container-high/70 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 text-center sm:text-left relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

          {/* Avatar */}
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-primary/20 shadow-md"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-2xl ring-4 ring-primary/20 shadow-md">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="absolute bottom-0 right-0 bg-emerald-600 text-white rounded-full p-1 shadow border-2 border-white" title="Relawan Terverifikasi">
              <span className="material-symbols-outlined text-[14px] block">verified</span>
            </span>
          </div>

          {/* Info & Meta */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
              <h1 className="text-xl sm:text-2xl font-bold text-on-surface truncate">
                {displayName}
              </h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="material-symbols-outlined text-[12px]">verified_user</span>
                Relawan Terverifikasi
              </span>
            </div>

            <p className="text-xs sm:text-sm text-on-surface-variant break-all mb-3">
              {email}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-outline">
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
          <div className="shrink-0 pt-1">
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
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-surface-container-lowest border border-surface-container-high/70 rounded-2xl p-4 text-center shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-1.5">
              <span className="material-symbols-outlined text-[18px]">mosque</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-on-surface">{totalSessions}</p>
            <p className="text-[11px] sm:text-xs text-on-surface-variant font-medium mt-0.5">Total Kontribusi</p>
          </div>

          <div className="bg-surface-container-lowest border border-surface-container-high/70 rounded-2xl p-4 text-center shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-1.5">
              <span className="material-symbols-outlined text-[18px]">pin_drop</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-800">{offlineCount}</p>
            <p className="text-[11px] sm:text-xs text-on-surface-variant font-medium mt-0.5">Kajian Fisik/Masjid</p>
          </div>

          <div className="bg-surface-container-lowest border border-surface-container-high/70 rounded-2xl p-4 text-center shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 mx-auto flex items-center justify-center mb-1.5">
              <span className="material-symbols-outlined text-[18px]">podcasts</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-blue-800">{onlineCount}</p>
            <p className="text-[11px] sm:text-xs text-on-surface-variant font-medium mt-0.5">Kajian Online</p>
          </div>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/kontributor/dashboard"
            className="flex items-center gap-3.5 p-4 rounded-2xl bg-primary text-white shadow-sm hover:bg-primary/95 transition-all active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">add_circle</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">Kirim Info Kajian Baru</h3>
              <p className="text-xs text-white/80 truncate">Input jadwal kajian yang akan tayang di peta</p>
            </div>
            <span className="material-symbols-outlined text-[18px] ml-auto shrink-0 opacity-80">arrow_forward</span>
          </Link>

          <Link
            href="/leaderboard"
            className="flex items-center gap-3.5 p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high/70 text-on-surface shadow-sm hover:border-amber-400 hover:bg-amber-50/30 transition-all active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>trophy</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">Peringkat Kontributor</h3>
              <p className="text-xs text-on-surface-variant truncate">Lihat posisi antum di papan amal kebaikan</p>
            </div>
            <span className="material-symbols-outlined text-[18px] ml-auto shrink-0 text-outline">arrow_forward</span>
          </Link>
        </div>

        {/* List of Submitted Kajian */}
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">history_edu</span>
              Riwayat Kajian yang Saya Kirim
            </h2>
            <span className="text-xs text-outline font-medium">
              {sessions.length} jadwal
            </span>
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
                const venueAddress = s.venues?.address;
                const dateDisplay = s.start_datetime
                  ? new Date(s.start_datetime).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }) + ' WIB'
                  : s.recurring_pattern || 'Jadwal Rutin';

                return (
                  <div key={s.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-container-low/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                          {s.speaker_name}
                        </span>
                        {s.is_online && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                            Online
                          </span>
                        )}
                        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          Tayang di Peta
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
                          <span>{dateDisplay}</span>
                        </span>
                      </div>
                    </div>

                    {s.is_online && s.stream_url && (
                      <a
                        href={s.stream_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors shrink-0"
                      >
                        <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                        Tautan Streaming
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

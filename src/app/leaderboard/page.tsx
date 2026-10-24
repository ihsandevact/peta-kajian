'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { fetchContributorLeaderboard, type ContributorEntry, type LeaderboardGroup } from '@/lib/services/kajian';
import { checkIsAdmin, getUserRoleAndStatus, type AppUserRole } from '@/lib/services/admin';
import dynamic from 'next/dynamic';
import DynamicBackButton from '@/components/navigation/DynamicBackButton';

const AppMenuBottomSheet = dynamic(() => import('@/components/navigation/AppMenuBottomSheet'), { ssr: false });

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardGroup>({ volunteers: [], channels: [] });
  const [activeTab, setActiveTab] = useState<'channels' | 'volunteers'>('channels');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<AppUserRole>('user');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchContributorLeaderboard()
      .then((res) => setData(res))
      .finally(() => setLoading(false));

    // Check user auth state
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUser(data.user);
        checkIsAdmin(data.user).then(setIsAdmin).catch(() => setIsAdmin(false));
        getUserRoleAndStatus(data.user).then((info) => setUserRole(info.role)).catch(() => setUserRole('user'));
      } else {
        supabase.auth.getSession().then(({ data: sess }) => {
          if (sess?.session?.user) {
            setCurrentUser(sess.session.user);
            checkIsAdmin(sess.session.user).then(setIsAdmin).catch(() => setIsAdmin(false));
            getUserRoleAndStatus(sess.session.user).then((info) => setUserRole(info.role)).catch(() => setUserRole('user'));
          }
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
      if (session?.user) {
        checkIsAdmin(session.user).then(setIsAdmin).catch(() => setIsAdmin(false));
        getUserRoleAndStatus(session.user).then((info) => setUserRole(info.role)).catch(() => setUserRole('user'));
      } else {
        setIsAdmin(false);
        setUserRole('user');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const currentList = activeTab === 'volunteers' ? data.volunteers : data.channels;
  const top3 = [
    currentList[1] || null, // 2nd (Left)
    currentList[0] || null, // 1st (Center)
    currentList[2] || null, // 3rd (Right)
  ];
  const rest = currentList.slice(3);

  const getInitials = (name: string) => {
    return name
      .replace(/^@/, '')
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const currentUserName =
    currentUser?.user_metadata?.full_name ||
    currentUser?.user_metadata?.name ||
    currentUser?.email?.split('@')[0] ||
    'Relawan';
  const currentUserAvatar = currentUser?.user_metadata?.avatar_url;

  return (
    <div className="min-h-screen bg-surface font-geist text-on-surface flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container-high/60 shadow-xs">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <DynamicBackButton />

          {/* Desktop Right Actions */}
          <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 shrink-0">
            {currentUser ? (
              <Link
                href="/kontributor/profile"
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-surface-container border border-surface-container-high hover:border-primary text-xs font-medium text-on-surface transition-all max-w-[120px] sm:max-w-[160px]"
                title="Buka Profil Relawan"
              >
                {currentUserAvatar && !avatarError ? (
                  <img
                    src={currentUserAvatar}
                    alt=""
                    className="w-5 h-5 rounded-full object-cover shrink-0"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                    {currentUserName ? currentUserName.slice(0, 1).toUpperCase() : 'U'}
                  </span>
                )}
                <span className="truncate text-[11px] sm:text-xs">{currentUserName}</span>
              </Link>
            ) : null}

            {currentUser ? (
              isAdmin || userRole === 'kontributor' ? (
                <Link
                  href="/kontributor/dashboard"
                  className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-primary hover:text-on-primary hover:bg-primary px-2.5 sm:px-3 py-1.5 rounded-full border border-primary/30 transition-colors whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[15px] sm:text-[16px]">add_circle</span>
                  <span>Kirim Info Kajian</span>
                </Link>
              ) : (
                <Link
                  href="/kontributor/profile"
                  className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:text-white hover:bg-emerald-600 px-2.5 sm:px-3 py-1.5 rounded-full border border-emerald-500/30 transition-colors whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[15px] sm:text-[16px]">volunteer_activism</span>
                  <span>Ajukan Jadi Relawan</span>
                </Link>
              )
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-primary hover:text-on-primary hover:bg-primary px-2.5 sm:px-3 py-1.5 rounded-full border border-primary/30 transition-colors whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[15px] sm:text-[16px]">login</span>
                <span>Masuk / Login</span>
              </Link>
            )}
          </div>

          {/* Mobile Single Hamburger Button */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="sm:hidden w-9 h-9 rounded-xl bg-surface-container/80 hover:bg-surface-container-high border border-outline-variant/50 flex items-center justify-center text-on-surface shadow-2xs active:scale-95 transition-all cursor-pointer"
            aria-label="Buka Menu Navigasi"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-on-surface"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="14" y2="12" />
              <line x1="4" y1="18" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* Vaul Bottom Sheet Menu Mobile */}
      <AppMenuBottomSheet
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentUser={
          currentUser
            ? {
                id: currentUser.id,
                name: currentUserName,
                email: currentUser.email,
                avatarUrl: currentUserAvatar,
                role: userRole,
              }
            : null
        }
        isAdmin={isAdmin}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-3 sm:px-4 py-5 sm:py-6 flex flex-col gap-5 sm:gap-6">
        {/* Page Hero Header */}
        <div className="text-center flex flex-col items-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shadow-inner mb-2.5">
            <span className="material-symbols-outlined text-[28px] sm:text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              workspace_premium
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
            Papan Kontributor Dakwah
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-md leading-relaxed px-2">
            Apresiasi relawan dan kanal informasi yang menyiarkan jadwal majelis ilmu di seluruh Indonesia.
          </p>
        </div>

        {/* 2-Tab Segmented Control (Kanal & Partner pertama, Relawan Jamaah kedua) */}
        <div className="grid grid-cols-2 p-1 sm:p-1.5 bg-surface-container-low rounded-2xl border border-surface-container-high/70 shadow-sm max-w-md w-full mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('channels')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'channels'
                ? 'bg-surface-container-lowest text-primary shadow-sm font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[17px] sm:text-[18px]">campaign</span>
            <span>Kanal & Partner</span>
            <span className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.2 rounded-full bg-primary/10 text-primary font-bold">
              {data.channels.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('volunteers')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'volunteers'
                ? 'bg-surface-container-lowest text-primary shadow-sm font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[17px] sm:text-[18px]">person</span>
            <span>Relawan Jamaah</span>
            {data.volunteers.length > 0 && (
              <span className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.2 rounded-full bg-primary/10 text-primary font-bold">
                {data.volunteers.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-outline">
            <span className="material-symbols-outlined animate-spin text-[36px]">progress_activity</span>
            <span className="text-xs sm:text-sm">Memuat data papan peringkat...</span>
          </div>
        ) : activeTab === 'volunteers' && data.volunteers.length === 0 ? (
          /* Empty State jika belum ada relawan yang menginput */
          <div className="py-12 px-6 text-center flex flex-col items-center gap-3.5 bg-surface-container-lowest border border-surface-container-high/60 rounded-3xl shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner border border-emerald-200 dark:border-emerald-800/60">
              <span className="material-symbols-outlined text-[36px]">volunteer_activism</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">
                {currentUser ? `Ahlan wa Sahlan, ${currentUserName}!` : 'Belum Ada Relawan Terdaftar'}
              </h3>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-1.5 max-w-sm leading-relaxed">
                {currentUser
                  ? 'Anda telah terdaftar sebagai relawan dakwah. Jadilah yang pertama mengirimkan info kajian di masjid sekitar Anda dan puncaki peringkat kebaikan!'
                  : 'Jadilah orang pertama yang mengirimkan info kajian di masjid sekitar Anda dan puncaki peringkat kebaikan!'}
              </p>
            </div>
            <Link
              href="/kontributor/dashboard"
              className="mt-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              {currentUser ? 'Kirim Info Kajian Baru' : 'Mulai Jadi Relawan Pertama'}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Podium Top 3 */}
            <div className="pt-2 sm:pt-4 pb-2">
              <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end">
                {/* Juara 2 (Perak - Kiri) */}
                {top3[0] ? (
                  <div className="flex flex-col items-center p-2.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center shadow-xs">
                    <div className="relative mb-1.5 sm:mb-2">
                      <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs sm:text-sm shadow-inner ring-2 ring-slate-300 dark:ring-slate-700">
                        {getInitials(top3[0].name)}
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-500 text-white text-[10px] sm:text-xs font-black flex items-center justify-center shadow">
                        2
                      </span>
                    </div>
                    <div className="h-8 sm:h-9 flex items-center justify-center w-full px-0.5 sm:px-1">
                      <span className="text-[11px] sm:text-sm font-semibold text-on-surface leading-tight line-clamp-2" title={top3[0].name}>
                        {top3[0].name}
                      </span>
                    </div>
                    <span className="mt-1 px-2 sm:px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] sm:text-xs font-bold text-slate-800 dark:text-slate-200">
                      {top3[0].count} <span className="font-normal opacity-75">kajian</span>
                    </span>
                  </div>
                ) : <div />}

                {/* Juara 1 (Emas - Tengah & Lebih Tinggi) */}
                {top3[1] ? (
                  <div className="flex flex-col items-center p-3 sm:p-5 rounded-2xl bg-gradient-to-b from-amber-100/80 to-amber-50/70 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-300 dark:border-amber-600/50 text-center shadow-md relative scale-105 z-10">
                    <div className="absolute -top-3.5 sm:-top-4 text-amber-500 flex justify-center">
                      <span className="material-symbols-outlined text-[20px] sm:text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        crown
                      </span>
                    </div>
                    <div className="relative mb-1.5 sm:mb-2 mt-0.5 sm:mt-1">
                      <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 text-amber-950 flex items-center justify-center font-extrabold text-sm sm:text-base shadow-md ring-3 sm:ring-4 ring-amber-400/60">
                        {getInitials(top3[1].name)}
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-500 text-white text-[10px] sm:text-xs font-black flex items-center justify-center shadow">
                        1
                      </span>
                    </div>
                    <div className="h-8 sm:h-9 flex items-center justify-center w-full px-0.5 sm:px-1">
                      <span className="text-[11px] sm:text-sm font-bold text-on-surface leading-tight line-clamp-2" title={top3[1].name}>
                        {top3[1].name}
                      </span>
                    </div>
                    <span className="mt-1 px-2.5 sm:px-3 py-0.5 rounded-full bg-amber-400/40 dark:bg-amber-500/20 text-[10px] sm:text-sm font-black text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-500/40">
                      {top3[1].count} <span className="font-normal text-[9px] sm:text-xs opacity-75">kajian</span>
                    </span>
                  </div>
                ) : <div />}

                {/* Juara 3 (Perunggu - Kanan) */}
                {top3[2] ? (
                  <div className="flex flex-col items-center p-2.5 sm:p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-center shadow-xs">
                    <div className="relative mb-1.5 sm:mb-2">
                      <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 flex items-center justify-center font-bold text-xs sm:text-sm shadow-inner ring-2 ring-amber-700/30 dark:ring-amber-600/40">
                        {getInitials(top3[2].name)}
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-700 text-white text-[10px] sm:text-xs font-black flex items-center justify-center shadow">
                        3
                      </span>
                    </div>
                    <div className="h-8 sm:h-9 flex items-center justify-center w-full px-0.5 sm:px-1">
                      <span className="text-[11px] sm:text-sm font-semibold text-on-surface leading-tight line-clamp-2" title={top3[2].name}>
                        {top3[2].name}
                      </span>
                    </div>
                    <span className="mt-1 px-2 sm:px-2.5 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/40 text-[10px] sm:text-xs font-bold text-amber-900 dark:text-amber-200 dark:border dark:border-amber-700/40">
                      {top3[2].count} <span className="font-normal opacity-75">kajian</span>
                    </span>
                  </div>
                ) : <div />}
              </div>
            </div>

            {/* Peringkat 4 - 10 List */}
            {rest.length > 0 && (
              <div className="divide-y divide-surface-container-high/60 border border-surface-container-high/60 rounded-2xl overflow-hidden bg-surface-container-lowest shadow-sm">
                {rest.map((contributor, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-surface-container-low/50 transition-colors">
                    <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                      <span className="w-5 sm:w-6 text-center text-xs font-bold text-outline shrink-0">
                        #{idx + 4}
                      </span>
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center font-semibold text-xs shrink-0">
                        {getInitials(contributor.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-on-surface truncate" title={contributor.name}>
                          {contributor.name}
                        </p>
                        <span className="text-[10px] sm:text-[11px] text-outline font-medium block truncate">
                          {contributor.handle || contributor.badge || 'Kontributor'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        {contributor.count}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-outline ml-1">kajian</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Call to Action Box: Ditampilkan pada tab Kanal & Partner sebagai ajakan menjadi relawan */}
        {activeTab === 'channels' && (
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 flex flex-col gap-3 shadow-sm mt-2">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-700 dark:text-emerald-400 text-[26px] shrink-0 mt-0.5">
                volunteer_activism
              </span>
              <div>
                <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                  {currentUser ? 'Pemberat Timbangan Amal Kebaikan' : 'Ikut Beramal Jariyah Menjadi Relawan Dakwah'}
                </h3>
                <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90 mt-1 leading-relaxed">
                  {currentUser
                    ? `Jazakallahu khairan atas keikutsertaan Anda, ${currentUserName}. Terus kirimkan jadwal kajian untuk memperluas manfaat ilmu syar'i bagi kaum muslimin.`
                    : 'Bantu sesama muslim menemukan majelis ilmu di kota Anda. Kirim jadwal kajian dari masjid terdekat dan raih pahala kebaikan yang mengalir.'}
                </p>
              </div>
            </div>
            <Link
              href="/kontributor/dashboard"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl text-center shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              {currentUser ? 'Kirim Info Kajian Baru' : 'Mulai Jadi Relawan Sekarang'}
            </Link>
          </div>
        )}

        {/* Action Button pada Tab Relawan Jamaah jika sudah ada data relawan (saat kosong, tombol sudah ada 1 di dalam Empty State) */}
        {activeTab === 'volunteers' && data.volunteers.length > 0 && (
          <Link
            href="/kontributor/dashboard"
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl text-center shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 mt-2"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            {currentUser ? 'Kirim Info Kajian Baru' : 'Kirim Info Kajian Sekarang'}
          </Link>
        )}
      </main>
    </div>
  );
}

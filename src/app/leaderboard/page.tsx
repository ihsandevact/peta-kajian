'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { fetchContributorLeaderboard, type ContributorEntry, type LeaderboardGroup } from '@/lib/services/kajian';

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardGroup>({ volunteers: [], channels: [] });
  const [activeTab, setActiveTab] = useState<'channels' | 'volunteers'>('channels');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

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
      } else {
        supabase.auth.getSession().then(({ data: sess }) => {
          if (sess?.session?.user) {
            setCurrentUser(sess.session.user);
          }
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
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
      <header className="sticky top-0 z-40 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container-high/60">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors py-1.5 px-2.5 rounded-lg hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Kembali ke Peta</span>
          </Link>

          <div className="flex items-center gap-2">
            {currentUser ? (
              <Link
                href="/kontributor/profile"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container border border-surface-container-high hover:border-primary text-xs font-medium text-on-surface transition-all"
                title="Buka Profil Relawan"
              >
                {currentUserAvatar ? (
                  <img src={currentUserAvatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                    {currentUserName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="max-w-[100px] truncate">{currentUserName}</span>
              </Link>
            ) : null}

            <Link
              href="/kontributor/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-on-primary hover:bg-primary px-3 py-1.5 rounded-full border border-primary/30 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>Kirim Info Kajian</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Page Hero Header */}
        <div className="text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-700 flex items-center justify-center shadow-inner mb-3">
            <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              workspace_premium
            </span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">
            Papan Kontributor Dakwah
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1.5 max-w-md leading-relaxed">
            Apresiasi relawan dan kanal informasi yang menyiarkan jadwal majelis ilmu di seluruh Indonesia.
          </p>
        </div>

        {/* 2-Tab Segmented Control (Kanal & Partner pertama, Relawan Jamaah kedua) */}
        <div className="grid grid-cols-2 p-1.5 bg-surface-container-low rounded-2xl border border-surface-container-high/70 shadow-sm max-w-md w-full mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('channels')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'channels'
                ? 'bg-surface-container-lowest text-primary shadow-sm font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">campaign</span>
            <span>Kanal & Partner</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
              {data.channels.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('volunteers')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'volunteers'
                ? 'bg-surface-container-lowest text-primary shadow-sm font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
            <span>Relawan Jamaah</span>
            {data.volunteers.length > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
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
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner border border-emerald-200">
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
            <div className="pt-4 pb-2">
              <div className="grid grid-cols-3 gap-2.5 sm:gap-4 items-end">
                {/* Juara 2 (Perak - Kiri) */}
                {top3[0] ? (
                  <div className="flex flex-col items-center p-3 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center shadow-sm">
                    <div className="relative mb-2">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shadow-inner ring-2 ring-slate-300">
                        {getInitials(top3[0].name)}
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-500 text-white text-xs font-black flex items-center justify-center shadow">
                        2
                      </span>
                    </div>
                    <div className="h-9 flex items-center justify-center w-full px-1">
                      <span className="text-xs sm:text-sm font-semibold text-on-surface leading-tight line-clamp-2" title={top3[0].name}>
                        {top3[0].name}
                      </span>
                    </div>
                    <span className="mt-1.5 px-2.5 py-0.5 rounded-full bg-slate-200 text-xs font-bold text-slate-800">
                      {top3[0].count} <span className="font-normal opacity-75">kajian</span>
                    </span>
                  </div>
                ) : <div />}

                {/* Juara 1 (Emas - Tengah & Lebih Tinggi) */}
                {top3[1] ? (
                  <div className="flex flex-col items-center p-3.5 sm:p-5 rounded-2xl bg-gradient-to-b from-amber-100/80 to-amber-50/70 border border-amber-300 text-center shadow-lg relative scale-105 z-10">
                    <div className="absolute -top-4 text-amber-500 flex justify-center">
                      <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        crown
                      </span>
                    </div>
                    <div className="relative mb-2 mt-1">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 text-amber-950 flex items-center justify-center font-extrabold text-base shadow-md ring-4 ring-amber-400/60">
                        {getInitials(top3[1].name)}
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-black flex items-center justify-center shadow">
                        1
                      </span>
                    </div>
                    <div className="h-9 flex items-center justify-center w-full px-1">
                      <span className="text-xs sm:text-sm font-bold text-on-surface leading-tight line-clamp-2" title={top3[1].name}>
                        {top3[1].name}
                      </span>
                    </div>
                    <span className="mt-1.5 px-3 py-0.5 rounded-full bg-amber-400/40 text-xs sm:text-sm font-black text-amber-950 border border-amber-300">
                      {top3[1].count} <span className="font-normal text-xs opacity-75">kajian</span>
                    </span>
                  </div>
                ) : <div />}

                {/* Juara 3 (Perunggu - Kanan) */}
                {top3[2] ? (
                  <div className="flex flex-col items-center p-3 sm:p-4 rounded-2xl bg-amber-50/50 border border-amber-200 text-center shadow-sm">
                    <div className="relative mb-2">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-sm shadow-inner ring-2 ring-amber-700/30">
                        {getInitials(top3[2].name)}
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-700 text-white text-xs font-black flex items-center justify-center shadow">
                        3
                      </span>
                    </div>
                    <div className="h-9 flex items-center justify-center w-full px-1">
                      <span className="text-xs sm:text-sm font-semibold text-on-surface leading-tight line-clamp-2" title={top3[2].name}>
                        {top3[2].name}
                      </span>
                    </div>
                    <span className="mt-1.5 px-2.5 py-0.5 rounded-full bg-amber-200/70 text-xs font-bold text-amber-900">
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
                  <div key={idx} className="flex items-center justify-between px-4 py-3 hover:bg-surface-container-low/50 transition-colors">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="w-6 text-center text-xs font-bold text-outline">
                        #{idx + 4}
                      </span>
                      <div className="w-9 h-9 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center font-semibold text-xs shrink-0">
                        {getInitials(contributor.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-on-surface truncate" title={contributor.name}>
                          {contributor.name}
                        </p>
                        <span className="text-[11px] text-outline font-medium">
                          {contributor.handle || contributor.badge || 'Kontributor'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-emerald-700">
                        {contributor.count}
                      </span>
                      <span className="text-[11px] text-outline ml-1">kajian</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Call to Action Box: Ditampilkan pada tab Kanal & Partner sebagai ajakan menjadi relawan */}
        {activeTab === 'channels' && (
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex flex-col gap-3 shadow-sm mt-2">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-700 text-[26px] shrink-0 mt-0.5">
                volunteer_activism
              </span>
              <div>
                <h3 className="text-sm font-bold text-emerald-950">
                  {currentUser ? 'Pemberat Timbangan Amal Kebaikan' : 'Ikut Beramal Jariyah Menjadi Relawan Dakwah'}
                </h3>
                <p className="text-xs text-emerald-800/90 mt-1 leading-relaxed">
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

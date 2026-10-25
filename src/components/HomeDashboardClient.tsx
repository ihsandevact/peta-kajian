'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useActiveSessionsQuery } from '@/lib/hooks/useActiveSessionsQuery';
import { useYoutubeChannelsQuery } from '@/lib/hooks/useYoutubeChannelsQuery';
import { fetchAllMosques, type MosqueVenue } from '@/lib/services/venues';
import { calculateDistance, estimateTravelTime } from '@/utils/distance';
import { getPrayerScheduleAndNext, type DailyPrayerTimes } from '@/utils/prayerTimes';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { useBookmarks } from '@/utils/bookmarks';
import { useAttendance } from '@/utils/attendance';
import { useLivePlayer } from '@/context/LivePlayerContext';
import ThemeToggle from '@/components/ThemeToggle';
import { type StudySession } from '@/lib/services/kajian';
import { getUserRoleAndStatus, type UserRoleInfo } from '@/lib/services/admin';
import { HomeKajianCardSkeleton, HomeMosqueCardSkeleton } from '@/components/HomeDashboardSkeleton';
import DailyHadithCard from '@/components/DailyHadithCard';

// Dynamic lazy imports for heavy interactive overlays
const MoreMenuBottomSheet = dynamic(() => import('@/components/MoreMenuBottomSheet'), { ssr: false });
const MobileNavDrawer = dynamic(() => import('@/components/MobileNavDrawer'), { ssr: false });
const MosqueProfileModal = dynamic(() => import('@/components/MosqueProfileModal'), { ssr: false });
const RequestContributorModal = dynamic(() => import('@/components/RequestContributorModal'), { ssr: false });

export default function HomeDashboardClient() {
  const router = useRouter();
  const { playStream, openStudyMode } = useLivePlayer();
  const { isBookmarked, toggle: toggleBookmark } = useBookmarks();
  const { isAttending, toggle: toggleAttendance } = useAttendance();

  // Autentikasi Supabase
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleInfo, setRoleInfo] = useState<UserRoleInfo | null>(null);
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        try {
          const info = await getUserRoleAndStatus(user);
          setRoleInfo(info);
          setIsAdmin(info.role === 'admin');
          setCurrentUser({
            ...user,
            role: info.role,
            requestStatus: info.requestStatus,
          });
        } catch {
          setCurrentUser(user);
        }
      } else {
        setCurrentUser(null);
        setIsAdmin(false);
        setRoleInfo(null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user || null;
      if (user) {
        try {
          const info = await getUserRoleAndStatus(user);
          setRoleInfo(info);
          setIsAdmin(info.role === 'admin');
          setCurrentUser({
            ...user,
            role: info.role,
            requestStatus: info.requestStatus,
          });
        } catch {
          setCurrentUser(user);
        }
      } else {
        setCurrentUser(null);
        setIsAdmin(false);
        setRoleInfo(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Lokasi Pengguna
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationName, setLocationName] = useState<string>('Indonesia (Pusat)');

  // Ambil lokasi tersimpan dari localStorage atau minta GPS saat interaksi
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user_last_location');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          setUserLocation(parsed);
          setLocationName(parsed.cityName || 'Lokasi Terdeteksi');
        }
      }
    } catch {}
  }, []);

  const requestUserLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      alert('Browser Anda tidak mendukung geolokasi.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setLocationName('Lokasi Saat Ini (GPS)');
        setIsLocating(false);
        try {
          localStorage.setItem(
            'user_last_location',
            JSON.stringify({ ...coords, cityName: 'Lokasi Saat Ini' })
          );
        } catch {}
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Jadwal Waktu Sholat Kemenag RI
  const [prayerSchedule, setPrayerSchedule] = useState<DailyPrayerTimes>(() =>
    getPrayerScheduleAndNext(userLocation?.lat || -6.2, userLocation?.lng || 106.816666)
  );

  useEffect(() => {
    const updatePrayer = () => {
      const lat = userLocation?.lat ?? -6.2;
      const lng = userLocation?.lng ?? 106.816666;
      setPrayerSchedule(getPrayerScheduleAndNext(lat, lng));
    };
    updatePrayer();
    const interval = setInterval(updatePrayer, 1000);
    return () => clearInterval(interval);
  }, [userLocation]);

  // Pencarian Cepat Global
  const [searchQuery, setSearchQuery] = useState('');
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/peta?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/peta');
    }
  };

  // 1. Data Kajian (TanStack Query)
  const { sessions, isLoading: isSessionsLoading } = useActiveSessionsQuery({
    currentUserRole: isAdmin ? 'admin' : 'user',
  });

  // Tab Filter Kajian di Beranda
  const [activeKajianTab, setActiveKajianTab] = useState<'hari-ini' | 'terdekat' | 'weekend' | 'online'>('hari-ini');

  const filteredKajianList = useMemo(() => {
    if (!sessions || sessions.length === 0) return [];
    const now = new Date();

    let list = sessions.map((s) => {
      const info = getEffectiveSessionInfo(s, now);
      let dist: number | null = null;
      if (userLocation && typeof s.venues?.lat === 'number' && typeof s.venues?.lng === 'number') {
        dist = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          s.venues.lat,
          s.venues.lng
        );
      }
      return { session: s, info, distance: dist };
    });

    if (activeKajianTab === 'hari-ini') {
      list = list.filter((item) => item.info.isToday && !item.info.isPast);
      if (list.length === 0) {
        // Fallback ke kajian mendatang terdekat jika hari ini belum ada
        list = sessions.slice(0, 4).map((s) => ({
          session: s,
          info: getEffectiveSessionInfo(s, now),
          distance:
            userLocation && typeof s.venues?.lat === 'number' && typeof s.venues?.lng === 'number'
              ? calculateDistance(userLocation.lat, userLocation.lng, s.venues.lat, s.venues.lng)
              : null,
        }));
      }
    } else if (activeKajianTab === 'terdekat') {
      list.sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));
    } else if (activeKajianTab === 'weekend') {
      list = list.filter((item) => {
        const d = item.info.effectiveDate?.getDay();
        return d === 0 || d === 6; // Minggu (0) atau Sabtu (6)
      });
    } else if (activeKajianTab === 'online') {
      list = list.filter((item) => item.session.is_online);
    }

    return list.slice(0, 4);
  }, [sessions, activeKajianTab, userLocation]);

  // 2. Data Live Streaming (TanStack Query)
  const { channels, isLoading: isChannelsLoading } = useYoutubeChannelsQuery();

  const activeLiveStreams = useMemo(() => {
    if (!channels) return [];
    const list: Array<{
      id: string;
      channelName: string;
      title: string;
      speakerName: string;
      videoId: string;
      channelHandle?: string;
    }> = [];

    channels.forEach((ch) => {
      if (ch.is_currently_live && ch.current_video_id) {
        list.push({
          id: ch.id,
          channelName: ch.channel_name,
          title: ch.current_video_title || `Live Kajian ${ch.channel_name}`,
          speakerName: ch.default_speaker_name || ch.channel_name,
          videoId: ch.current_video_id,
          channelHandle: ch.channel_handle,
        });
      }
    });
    return list;
  }, [channels]);

  // 3. Data Masjid Terdekat (TanStack Query)
  const { data: allMosques = [], isLoading: isMosquesLoading } = useQuery<MosqueVenue[]>({
    queryKey: ['mosques', 'home-preview', { isAdmin }],
    staleTime: 1000 * 60 * 5,
    queryFn: () => fetchAllMosques({ limit: 60, includeTestData: isAdmin }),
  });

  const nearbyMosques = useMemo(() => {
    if (!allMosques || allMosques.length === 0) return [];

    const computed = allMosques.map((m) => {
      let dist: number | null = null;
      if (userLocation && typeof m.lat === 'number' && typeof m.lng === 'number') {
        dist = calculateDistance(userLocation.lat, userLocation.lng, m.lat, m.lng);
      }
      return { ...m, distance_km: dist !== null ? dist : undefined };
    });

    if (userLocation) {
      computed.sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999));
    } else {
      // Prioritaskan masjid dengan kajian aktif
      computed.sort((a, b) => (b.active_sessions_count || 0) - (a.active_sessions_count || 0));
    }

    return computed.slice(0, 4);
  }, [allMosques, userLocation]);

  // Modal Profil Masjid
  const [profileMosque, setProfileMosque] = useState<MosqueVenue | null>(null);

  // Tanggal Hari Ini (Masehi & Estimasi Hijriah)
  const todayFormatted = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-on-surface font-geist flex flex-col selection:bg-emerald-500/20 selection:text-emerald-800 dark:selection:text-emerald-200 pb-[calc(76px+env(safe-area-inset-bottom,16px))] md:pb-0">
      {/* 1. NAVBAR HEADER (HANYA DITAMPILKAN DI DESKTOP, DISEMBUNYIKAN DI MOBILE) */}
      <header className="hidden md:block sticky top-0 z-40 w-full bg-surface/90 backdrop-blur-md border-b border-outline-variant/40 transition-colors">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3 sm:gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
              <img
                src="/logo.png?v=3"
                alt="Peta Kajian Logo"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-xs group-hover:scale-105 transition-transform"
              />
              <div>
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-on-surface">
                  Peta Kajian
                </span>
                <span className="hidden sm:inline-block ml-1.5 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 rounded-md">
                  Indonesia
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-bold text-on-surface-variant">
            <Link
              href="/"
              className="px-3.5 py-2 rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 font-extrabold"
            >
              Beranda
            </Link>
            <Link
              href="/peta"
              className="px-3.5 py-2 rounded-xl hover:bg-surface-container hover:text-on-surface transition-colors"
            >
              Peta Kajian
            </Link>
            <Link
              href="/masjid"
              className="px-3.5 py-2 rounded-xl hover:bg-surface-container hover:text-on-surface transition-colors"
            >
              Direktori Masjid
            </Link>
            <Link
              href="/live"
              className="px-3.5 py-2 rounded-xl hover:bg-surface-container hover:text-on-surface transition-colors flex items-center gap-1.5"
            >
              <span>Live Streaming</span>
              {activeLiveStreams.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              )}
            </Link>
            <Link
              href="/leaderboard"
              className="px-3.5 py-2 rounded-xl hover:bg-surface-container hover:text-on-surface transition-colors"
            >
              Peringkat
            </Link>
          </nav>

          {/* Header Actions (Theme, Login/Profile, Mobile Hamburger) */}
          <div className="flex items-center gap-2">
            <ThemeToggle variant="icon" />

            {currentUser ? (
              <Link
                href="/kontributor/profile"
                className="hidden sm:flex items-center gap-2 py-1.5 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-xs font-bold text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-emerald-600">
                  account_circle
                </span>
                <span className="truncate max-w-[120px]">
                  {currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]}
                </span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="hidden sm:inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">login</span>
                <span>Masuk</span>
              </Link>
            )}

            {/* Mobile Menu Hamburger */}
            <button
              type="button"
              onClick={() => setIsNavDrawerOpen(true)}
              className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/60 cursor-pointer"
              aria-label="Buka menu navigasi"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO BENTO SECTION: Waktu Sholat Kemenag RI & Pencarian Cepat */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-600/10 via-emerald-600/5 to-transparent pt-4 sm:pt-6 pb-6 sm:pb-8 border-b border-outline-variant/30">
        {/* Quick Switch Dark Mode Khusus Mobile (Pojok Kanan Atas, Ukuran Ringkas Hijau) */}
        <div className="md:hidden absolute top-3.5 right-3.5 z-20">
          <ThemeToggle
            variant="icon"
            size="sm"
            className="bg-surface/90 hover:bg-surface border border-outline-variant/60 shadow-xs rounded-lg"
          />
        </div>

        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
          {/* Baris Sapaan & Tanggal */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 pr-9 md:pr-0">
            <div>
              <p
                suppressHydrationWarning
                className="text-[11px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider"
              >
                {todayFormatted}
              </p>
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-on-surface tracking-tight mt-0.5">
                {currentUser?.user_metadata?.full_name
                  ? `Assalamu'alaikum, ${currentUser.user_metadata.full_name}`
                  : "Assalamu'alaikum, Penuntut Ilmu"}
              </h1>
              <p className="text-[11px] sm:text-sm text-on-surface-variant mt-0.5 sm:mt-1 max-w-xl">
                Temukan jadwal majelis ilmu, siaran live streaming, dan navigasi masjid terdekat di seluruh Indonesia.
              </p>
            </div>

            {/* Tombol Deteksi Lokasi GPS */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                type="button"
                onClick={requestUserLocation}
                disabled={isLocating}
                className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-surface/90 hover:bg-surface border border-outline-variant/60 shadow-xs text-[11px] sm:text-xs font-bold text-on-surface transition-all cursor-pointer"
                title="Perbarui koordinat lokasi GPS"
              >
                <span
                  className={`material-symbols-outlined text-[15px] sm:text-[16px] text-emerald-600 ${
                    isLocating ? 'animate-spin' : ''
                  }`}
                >
                  {isLocating ? 'progress_activity' : 'near_me'}
                </span>
                <span className="truncate max-w-[150px] sm:max-w-[160px]">{locationName}</span>
              </button>
            </div>
          </div>

          {/* Baris Waktu Sholat Real-Time (Kemenag RI) */}
          <div className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-surface/95 backdrop-blur-md border border-emerald-600/25 shadow-sm space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-outline-variant/30 pb-2.5 sm:pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[17px] sm:text-[20px]">schedule</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="text-xs sm:text-sm font-extrabold text-on-surface">
                      Waktu Sholat
                    </h2>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 text-[9px] sm:text-[10px] font-bold">
                      {prayerSchedule.timezoneLabel}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-on-surface-variant">
                    Standar Kemenag RI
                  </p>
                </div>
              </div>

              {/* Countdown Target Sholat Berikutnya */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-2xl bg-emerald-600 text-white shadow-xs shrink-0 text-right">
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-0 sm:gap-1.5">
                  <span
                    suppressHydrationWarning
                    className="text-[10px] sm:text-xs font-extrabold whitespace-nowrap leading-tight"
                  >
                    {prayerSchedule.nextPrayer.name} {prayerSchedule.nextPrayer.time}
                  </span>
                  <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span
                    suppressHydrationWarning
                    className="text-[9px] sm:text-xs font-semibold sm:font-bold text-emerald-100 sm:text-white font-mono whitespace-nowrap leading-tight"
                  >
                    {prayerSchedule.nextPrayer.countdownText}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid 5 Waktu Sholat */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5 text-center">
              {(
                [
                  { id: 'subuh', label: 'Subuh', time: prayerSchedule.subuh, icon: 'wb_twilight' },
                  { id: 'dzuhur', label: 'Dzuhur', time: prayerSchedule.dzuhur, icon: 'wb_sunny' },
                  { id: 'ashar', label: 'Ashar', time: prayerSchedule.ashar, icon: 'light_mode' },
                  { id: 'maghrib', label: 'Maghrib', time: prayerSchedule.maghrib, icon: 'wb_twilight' },
                  { id: 'isya', label: 'Isya', time: prayerSchedule.isya, icon: 'bedtime' },
                ] as const
              ).map((item) => {
                const isNext = prayerSchedule.nextPrayer.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col items-center justify-center py-2 sm:py-3 px-1 sm:px-2 rounded-xl sm:rounded-2xl transition-all border ${
                      isNext
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm ring-1 sm:ring-2 ring-emerald-500/20'
                        : 'bg-surface-container-low/70 hover:bg-surface-container-low border-outline-variant/40 text-on-surface'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[16px] sm:text-[20px] mb-0.5 sm:mb-1 ${
                        isNext ? 'text-white' : 'text-emerald-600 dark:text-emerald-400 opacity-80'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span
                      className={`text-[10px] sm:text-xs font-semibold leading-tight ${
                        isNext ? 'text-white/95' : 'text-on-surface-variant'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="text-[11px] sm:text-sm font-extrabold mt-0.5 sm:mt-1 tracking-tight font-mono">
                      {item.time}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Global Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative max-w-3xl mx-auto">
            <span className="material-symbols-outlined absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-[18px] sm:text-[20px] text-on-surface-variant">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kajian, ustadz, atau masjid..."
              className="w-full pl-9 pr-16 sm:pl-11 sm:pr-24 py-2.5 sm:py-3.5 text-xs sm:text-sm bg-surface rounded-xl sm:rounded-2xl border border-outline-variant/60 shadow-xs sm:shadow-md focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-on-surface placeholder:text-on-surface-variant/60"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg sm:rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
            >
              Cari
            </button>
          </form>
        </div>
      </section>

      {/* 3. BENTO QUICK LINKS: 4 PILAR UTAMA */}
      <section className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 w-full">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* Pilar 1: Peta Kajian */}
          <Link
            href="/peta"
            className="group p-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-surface hover:bg-surface-container-low border border-outline-variant/50 hover:border-emerald-500/50 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-1.5 mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <span className="material-symbols-outlined text-[20px] sm:text-[24px]">map</span>
                </div>
                <span className="px-1.5 sm:px-2.5 py-0.5 rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 text-[9px] sm:text-[10px] font-extrabold truncate">
                  {sessions.length > 0 ? `${sessions.length} Kajian` : 'Peta'}
                </span>
              </div>
              <h3 className="text-xs sm:text-base font-extrabold text-on-surface group-hover:text-emerald-600 transition-colors leading-snug">
                Peta Kajian
              </h3>
              <p className="hidden sm:block text-xs text-on-surface-variant mt-1 leading-relaxed">
                Eksplorasi persebaran ratusan jadwal kajian di peta lengkap dengan navigasi jalan.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-2.5 sm:mt-4 group-hover:underline">
              <span>Buka Peta</span>
              <span className="material-symbols-outlined text-[13px] sm:text-[15px] group-hover:translate-x-0.5 transition-transform">
                arrow_forward
              </span>
            </div>
          </Link>

          {/* Pilar 2: Direktori Masjid */}
          <Link
            href="/masjid"
            className="group p-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-surface hover:bg-surface-container-low border border-outline-variant/50 hover:border-teal-500/50 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-1.5 mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <span className="material-symbols-outlined text-[20px] sm:text-[24px]">mosque</span>
                </div>
                <span className="px-1.5 sm:px-2.5 py-0.5 rounded-full bg-teal-600/10 text-teal-700 dark:text-teal-300 text-[9px] sm:text-[10px] font-extrabold truncate">
                  13.000+ Masjid
                </span>
              </div>
              <h3 className="text-xs sm:text-base font-extrabold text-on-surface group-hover:text-teal-600 transition-colors leading-snug">
                Direktori Masjid
              </h3>
              <p className="hidden sm:block text-xs text-on-surface-variant mt-1 leading-relaxed">
                Temukan masjid sunnah di sekitar Anda dengan info fasilitas, rute, dan jadwal rutin.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-teal-600 dark:text-teal-400 mt-2.5 sm:mt-4 group-hover:underline">
              <span>Cari Masjid</span>
              <span className="material-symbols-outlined text-[13px] sm:text-[15px] group-hover:translate-x-0.5 transition-transform">
                arrow_forward
              </span>
            </div>
          </Link>

          {/* Pilar 3: Live Streaming */}
          <Link
            href="/live"
            className="group p-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-surface hover:bg-surface-container-low border border-outline-variant/50 hover:border-red-500/50 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-1.5 mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <span className="material-symbols-outlined text-[20px] sm:text-[24px]">smart_display</span>
                </div>
                {activeLiveStreams.length > 0 ? (
                  <span className="inline-flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[9px] sm:text-[10px] font-extrabold animate-pulse truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                    <span>{activeLiveStreams.length} Live</span>
                  </span>
                ) : (
                  <span className="px-1.5 sm:px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[9px] sm:text-[10px] font-extrabold truncate">
                    Streaming
                  </span>
                )}
              </div>
              <h3 className="text-xs sm:text-base font-extrabold text-on-surface group-hover:text-red-600 transition-colors leading-snug">
                Live Kajian
              </h3>
              <p className="hidden sm:block text-xs text-on-surface-variant mt-1 leading-relaxed">
                Tonton siaran langsung majelis ilmu dari berbagai channel dakwah sunnah terpercaya.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-red-600 dark:text-red-400 mt-2.5 sm:mt-4 group-hover:underline">
              <span>Tonton Siaran</span>
              <span className="material-symbols-outlined text-[13px] sm:text-[15px] group-hover:translate-x-0.5 transition-transform">
                arrow_forward
              </span>
            </div>
          </Link>

          {/* Pilar 4: Menu Lainnya (Membuka Vaul Bottom Sheet) */}
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(true)}
            className="group p-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-surface hover:bg-surface-container-low border border-outline-variant/50 hover:border-emerald-500/50 shadow-xs hover:shadow-md transition-all flex flex-col justify-between text-left cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between gap-1.5 mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <span className="material-symbols-outlined text-[20px] sm:text-[24px]">widgets</span>
                </div>
                <span className="px-1.5 sm:px-2.5 py-0.5 rounded-full bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 text-[9px] sm:text-[10px] font-extrabold truncate">
                  Lengkap
                </span>
              </div>
              <h3 className="text-xs sm:text-base font-extrabold text-on-surface group-hover:text-emerald-600 transition-colors leading-snug">
                Menu Lainnya
              </h3>
              <p className="hidden sm:block text-xs text-on-surface-variant mt-1 leading-relaxed">
                Buku saku, leaderboard, info relawan, bantuan &amp; pengaturan tema aplikasi.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-2.5 sm:mt-4 group-hover:underline">
              <span>Buka Menu</span>
              <span className="material-symbols-outlined text-[13px] sm:text-[15px] group-hover:translate-x-0.5 transition-transform">
                arrow_forward
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* 4. SEKSI SEDANG LIVE STREAMING (JIKA ADA SIARAN AKTIF) */}
      {activeLiveStreams.length > 0 && (
        <section className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pb-6 sm:pb-8 w-full">
          <div className="p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl bg-red-600/5 border border-red-500/25 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping shrink-0" />
                <h2 className="text-sm sm:text-lg font-extrabold text-on-surface truncate">
                  Sedang Siaran Langsung Saat Ini
                </h2>
                <span className="px-1.5 sm:px-2 py-0.2 rounded-full bg-red-600 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider shrink-0">
                  Live
                </span>
              </div>
              <Link
                href="/live"
                className="text-[11px] sm:text-xs font-bold text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <span>Lihat Semua ({activeLiveStreams.length})</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {activeLiveStreams.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-surface border border-red-500/20 shadow-xs flex flex-col justify-between space-y-2.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold text-red-600 dark:text-red-400 uppercase tracking-wider truncate">
                        {item.channelName}
                      </span>
                      <span className="px-1.5 py-0.2 rounded-md bg-red-600 text-white text-[9px] font-extrabold shrink-0">
                        ON AIR
                      </span>
                    </div>
                    <h3 className="font-bold text-xs sm:text-sm text-on-surface line-clamp-2 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-on-surface-variant font-medium truncate">
                      Pemateri: {item.speakerName}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/20">
                    <button
                      type="button"
                      onClick={() =>
                        playStream({
                          videoId: item.videoId,
                          title: item.title,
                          channelName: item.channelName,
                          speakerName: item.speakerName,
                        })
                      }
                      className="flex-1 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px] sm:text-[16px]">play_arrow</span>
                      <span>Tonton Langsung</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openStudyMode({
                          videoId: item.videoId,
                          title: item.title,
                          speakerName: item.speakerName,
                          channelName: item.channelName,
                        })
                      }
                      className="p-1.5 sm:p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/50 transition-colors"
                      title="Catat Faedah Ilmu"
                    >
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]">edit_note</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. SEKSI MUTIARA HADITS (FAEDAH ILMU) */}
      <DailyHadithCard />

      {/* 6. SEKSI KAJIAN HARI INI & PILIHAN */}
      <section className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pb-8 sm:pb-10 w-full space-y-3.5 sm:space-y-4">
        {/* Header Seksi & Tab Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div>
            <h2 className="text-base sm:text-xl font-extrabold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-600 text-[20px] sm:text-[24px]">event_note</span>
              <span>Jadwal Kajian Terdekat &amp; Hari Ini</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">
              Agenda majelis ta&apos;lim sunnah yang berlangsung di sekitar Anda
            </p>
          </div>

          {/* Tab Filter */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-surface-container-low p-1 rounded-xl sm:rounded-2xl border border-outline-variant/40 self-start sm:self-auto">
            {(
              [
                { id: 'hari-ini', label: 'Hari Ini' },
                { id: 'terdekat', label: 'Terdekat' },
                { id: 'weekend', label: 'Akhir Pekan' },
                { id: 'online', label: 'Online' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveKajianTab(tab.id)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-extrabold rounded-lg sm:rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  activeKajianTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Daftar Kartu Kajian */}
        {isSessionsLoading ? (
          <div className="flex overflow-x-auto snap-x snap-mandatory pb-2 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 no-scrollbar">
            {Array.from({ length: 4 }).map((_, i) => (
              <HomeKajianCardSkeleton key={i} className="w-[82vw] sm:w-auto shrink-0 snap-start" />
            ))}
          </div>
        ) : filteredKajianList.length === 0 ? (
          <div className="p-6 sm:p-8 text-center rounded-2xl sm:rounded-3xl border border-outline-variant/40 bg-surface text-on-surface-variant space-y-2">
            <span className="material-symbols-outlined text-[32px] sm:text-[36px] text-outline">event_busy</span>
            <p className="text-xs sm:text-sm font-bold">Tidak ada kajian aktif untuk kategori ini saat ini.</p>
            <Link
              href="/peta"
              className="inline-block text-xs font-bold text-emerald-600 hover:underline"
            >
              Lihat Seluruh Jadwal di Peta Kajian →
            </Link>
          </div>
        ) : (
          <div className="flex overflow-x-auto snap-x snap-mandatory pb-2 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 no-scrollbar">
            {filteredKajianList.map(({ session, info, distance }) => {
              const booked = isBookmarked(session.id);
              const attend = isAttending(session.id);
              const timeStr = info.effectiveDate
                ? info.effectiveDate.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }) + ' WIB'
                : '';

              return (
                <div
                  key={session.id}
                  className="w-[82vw] sm:w-auto shrink-0 snap-start group p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-outline-variant/50 bg-surface hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between space-y-2.5 sm:space-y-3"
                >
                  <div className="space-y-1.5 sm:space-y-2">
                    {/* Badge Tanggal & Jarak */}
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-600/10 px-2 py-0.5 rounded-full truncate">
                        <span>{info.dateLabel}</span>
                        {timeStr && <span>• {timeStr}</span>}
                      </span>

                      {distance !== null && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full shrink-0">
                          <span className="material-symbols-outlined text-[11px]">near_me</span>
                          <span>{distance.toFixed(1)} km</span>
                        </span>
                      )}
                    </div>

                    {/* Judul & Pemateri */}
                    <h3 className="font-extrabold text-sm sm:text-base text-on-surface group-hover:text-emerald-600 transition-colors line-clamp-2 leading-snug">
                      {session.title}
                    </h3>
                    <p className="text-xs font-semibold text-on-surface-variant line-clamp-1">
                      Pemateri: {session.speaker_name}
                    </p>

                    {/* Lokasi / Masjid */}
                    <div className="flex items-center gap-1.5 text-xs text-on-surface-variant/80 pt-0.5">
                      <span className="material-symbols-outlined text-[14px] text-emerald-600 shrink-0">
                        {session.is_online ? 'videocam' : 'location_on'}
                      </span>
                      <span className="truncate">
                        {session.is_online
                          ? 'Kajian Online / Disiarkan'
                          : session.venues?.name || 'Lokasi belum ditentukan'}
                      </span>
                    </div>
                  </div>

                  {/* Tombol Aksi Bawah */}
                  <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-outline-variant/30 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleAttendance(session.id)}
                        className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl border transition-colors cursor-pointer ${
                          attend
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-surface-container hover:bg-surface-container-high border-outline-variant/60 text-on-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px] sm:text-[14px]">how_to_reg</span>
                        <span>{attend ? 'Hadir' : 'Saya Hadir'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleBookmark(session.id)}
                        className={`p-1 sm:p-1.5 rounded-lg sm:rounded-xl border transition-colors cursor-pointer ${
                          booked
                            ? 'bg-amber-100 text-amber-700 border-amber-400 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-surface-container hover:bg-surface-container-high border-outline-variant/60 text-on-surface'
                        }`}
                        title={booked ? 'Hapus Simpanan' : 'Simpan Kajian'}
                      >
                        <span className="material-symbols-outlined text-[15px] sm:text-[16px]">
                          {booked ? 'bookmark_added' : 'bookmark'}
                        </span>
                      </button>
                    </div>

                    <Link
                      href={`/peta?session=${session.id}`}
                      className="inline-flex items-center gap-0.5 text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                    >
                      <span>Lihat di Peta</span>
                      <span className="material-symbols-outlined text-[13px] sm:text-[14px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tombol Lihat Seluruh Kajian */}
        <div className="pt-2 text-center">
          <Link
            href="/peta"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold shadow-xs transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">map</span>
            <span>Jelajahi Semua {sessions.length.toLocaleString('id-ID')} Kajian di Peta</span>
            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">arrow_forward</span>
          </Link>
        </div>
      </section>

      {/* 6. SEKSI MASJID TERDEKAT */}
      <section className="bg-surface-container-lowest/60 border-t border-outline-variant/30 pt-6 pb-24 sm:py-10">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-4 sm:space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
            <div>
              <h2 className="text-base sm:text-xl font-extrabold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-teal-600 text-[20px] sm:text-[24px]">mosque</span>
                <span>Masjid Terdekat &amp; Titik Lokasi Sholat</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-on-surface-variant">
                13.000+ masjid sunnah di seluruh Indonesia lengkap dengan fasilitas dan rute
              </p>
            </div>
            <Link
              href="/masjid"
              className="text-[11px] sm:text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Lihat Semua 13.000+ Masjid</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>

          {/* Grid Masjid (Mobile Swipe / Desktop 4-Kolom) */}
          <div className="flex overflow-x-auto snap-x snap-mandatory pb-2 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 no-scrollbar">
            {isMosquesLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <HomeMosqueCardSkeleton key={i} className="w-[78vw] sm:w-auto shrink-0 snap-start" />
                ))
              : nearbyMosques.map((mosque) => {
                  const travel =
                    typeof mosque.distance_km === 'number'
                      ? estimateTravelTime(mosque.distance_km)
                      : null;

                  return (
                    <div
                      key={mosque.id}
                      className="w-[78vw] sm:w-auto shrink-0 snap-start group p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-outline-variant/50 bg-surface hover:border-teal-500/50 hover:shadow-md transition-all flex flex-col justify-between space-y-2.5 sm:space-y-3"
                    >
                      <div className="space-y-1.5 sm:space-y-2">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[18px] sm:text-[22px]">mosque</span>
                          </div>

                          {typeof mosque.distance_km === 'number' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full shrink-0">
                              <span>{mosque.distance_km.toFixed(1)} km</span>
                              {travel && <span>• {travel.label}</span>}
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="font-extrabold text-xs sm:text-sm text-on-surface group-hover:text-teal-600 transition-colors line-clamp-2 leading-snug">
                            {mosque.name}
                          </h3>
                          <p className="text-[11px] text-on-surface-variant line-clamp-1 mt-0.5">
                            {mosque.address || mosque.city || 'Indonesia'}
                          </p>
                        </div>

                        {mosque.active_sessions_count && mosque.active_sessions_count > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-600/10 px-2 py-0.5 rounded-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{mosque.active_sessions_count} Kajian Aktif</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-outline">Belum ada kajian aktif</span>
                        )}
                      </div>

                      {/* Tombol Aksi */}
                      <div className="flex items-center gap-1.5 pt-2 border-t border-outline-variant/30">
                        <button
                          type="button"
                          onClick={() => setProfileMosque(mosque)}
                          className="flex-1 py-1.5 px-2 rounded-lg sm:rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold border border-outline-variant/60 transition-colors cursor-pointer"
                        >
                          Profil
                        </button>

                        <Link
                          href={`/masjid?route=${mosque.slug || mosque.id}`}
                          className="py-1.5 px-2.5 sm:px-3 rounded-lg sm:rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[13px] sm:text-[14px]">directions</span>
                          <span>Rute</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      </section>

      {/* 7. FOOTER (Hanya tampil di Desktop, disembunyikan di Mobile karena ada Bottom Navigation) */}
      <footer className="hidden md:block mt-auto border-t border-outline-variant/40 bg-surface-container-low py-6 sm:py-8 text-xs text-on-surface-variant">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <img src="/logo.png?v=3" alt="Logo" className="w-5 h-5 sm:w-6 sm:h-6 rounded-md object-contain" />
              <span className="font-extrabold text-on-surface text-xs sm:text-sm">Peta Kajian Indonesia</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-[11px] sm:text-xs">
              <Link href="/peta" className="hover:text-emerald-600 transition-colors">
                Peta Kajian
              </Link>
              <Link href="/masjid" className="hover:text-emerald-600 transition-colors">
                Direktori Masjid
              </Link>
              <Link href="/live" className="hover:text-emerald-600 transition-colors">
                Live Streaming
              </Link>
              <Link href="/leaderboard" className="hover:text-emerald-600 transition-colors">
                Papan Peringkat
              </Link>
              <Link href="/faq" className="hover:text-emerald-600 transition-colors">
                Bantuan &amp; FAQ
              </Link>
            </div>
          </div>

          <div className="border-t border-outline-variant/30 pt-3 sm:pt-4 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-[10px] sm:text-[11px] text-outline text-center sm:text-left">
            <p>
              &copy; {new Date().getFullYear()} Peta Kajian Indonesia.
            </p>
            <p>
              Data lokasi masjid &copy; Overture Maps Foundation, OSM contributors.
            </p>
          </div>
        </div>
      </footer>

      {/* Vaul Bottom Sheet Menu Lainnya */}
      <MoreMenuBottomSheet
        isOpen={isMoreMenuOpen}
        onClose={() => setIsMoreMenuOpen(false)}
        currentUser={currentUser}
        isAdmin={isAdmin}
        userRole={roleInfo?.role}
        onOpenRequestContributor={() => setIsRequestModalOpen(true)}
      />

      {/* Modal Navigasi Mobile Drawer (Fallback) */}
      <MobileNavDrawer
        isOpen={isNavDrawerOpen}
        onClose={() => setIsNavDrawerOpen(false)}
        currentUser={currentUser}
        isAdmin={isAdmin}
        onOpenRequestContributor={() => setIsRequestModalOpen(true)}
      />

      {/* Modal Profil Masjid dari Beranda */}
      <MosqueProfileModal
        isOpen={Boolean(profileMosque)}
        mosque={profileMosque}
        onClose={() => setProfileMosque(null)}
        onStartRoute={(m) => router.push(`/masjid?route=${m.slug || m.id}`)}
      />

      {/* Modal Kontributor */}
      <RequestContributorModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSuccess={async () => {
          setIsRequestModalOpen(false);
          if (currentUser) {
            try {
              const info = await getUserRoleAndStatus(currentUser);
              setRoleInfo(info);
              setIsAdmin(info.role === 'admin');
              setCurrentUser((prev: any) => ({
                ...prev,
                role: info.role,
                requestStatus: info.requestStatus,
              }));
            } catch {}
          }
        }}
        userEmail={currentUser?.email}
      />
    </div>
  );
}

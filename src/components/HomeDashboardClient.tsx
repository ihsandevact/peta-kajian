'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useActiveSessionsQuery } from '@/lib/hooks/useActiveSessionsQuery';
import { useYoutubeChannelsQuery } from '@/lib/hooks/useYoutubeChannelsQuery';
import { evaluateAndQuerySessions, type EvaluatedStudySession } from '@/lib/domain/kajianQuery';
import { getPrayerScheduleAndNext, type DailyPrayerTimes } from '@/utils/prayerTimes';
import { getHijriDate } from '@/utils/hijri';
import { useBookmarks } from '@/utils/bookmarks';
import { useAttendance } from '@/utils/attendance';
import { useLivePlayer } from '@/context/LivePlayerContext';
import ThemeToggle from '@/components/ThemeToggle';
import { getUserRoleAndStatus, type UserRoleInfo } from '@/lib/services/admin';
import { HomeKajianCardSkeleton, HomeArticleCardSkeleton } from '@/components/HomeDashboardSkeleton';
import DailyHadithCard from '@/components/DailyHadithCard';
import { INITIAL_ARTICLES, type IslamicArticle } from '@/data/initialArticles';

// Dynamic lazy imports for interactive sheets/modals
const MoreMenuBottomSheet = dynamic(() => import('@/components/MoreMenuBottomSheet'), { ssr: false });
const MobileNavDrawer = dynamic(() => import('@/components/MobileNavDrawer'), { ssr: false });
const RequestContributorModal = dynamic(() => import('@/components/RequestContributorModal'), { ssr: false });

// Ilustrasi netral & menenangkan untuk thumbnail artikel pilihan di beranda
const CURATED_ARTICLE_THUMBNAILS = [
  'https://images.unsplash.com/photo-1584286595398-a59f21d313f5?auto=format&fit=crop&w=320&q=80',
  'https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&w=320&q=80',
  'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=320&q=80',
];

type HomeKajianChip = 'hari_ini' | 'dekat_saya' | 'online' | 'tersimpan';

/**
 * Kartu Artikel Pilihan Beranda (List dengan Thumbnail Kecil di Kiri)
 */
function HomeArticleListItem({
  art,
  index,
}: {
  art: IslamicArticle;
  index: number;
}) {
  const [imgError, setImgError] = useState(false);
  const safeThumbUrl = CURATED_ARTICLE_THUMBNAILS[index % CURATED_ARTICLE_THUMBNAILS.length];

  return (
    <Link
      href={`/artikel/${art.slug}`}
      className="p-3 sm:p-3.5 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/25 hover:border-[#126947]/40 transition-all flex items-center gap-3.5 group shadow-2xs"
    >
      {/* Thumbnail Kecil di Kiri */}
      <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden bg-[#e4eee8] dark:bg-emerald-950/60 shrink-0 relative border border-outline-variant/20">
        {!imgError ? (
          <img
            src={safeThumbUrl}
            alt={art.title}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
            <span className="material-symbols-outlined text-2xl text-[#126947] dark:text-emerald-400">
              menu_book
            </span>
          </div>
        )}
      </div>

      {/* Konten Teks di Kanan */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#126947] dark:text-emerald-400">
          <span className="truncate max-w-[140px]">{art.sourceName}</span>
          <span>&middot;</span>
          <span className="text-on-surface-variant font-medium shrink-0">
            {art.readTimeMinutes} mnt baca
          </span>
        </div>

        <h3 className="font-bold text-[14px] text-on-surface group-hover:text-[#126947] dark:group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">
          {art.title}
        </h3>

        <p className="text-[12px] text-on-surface-variant truncate">
          {art.authorName}
        </p>
      </div>
    </Link>
  );
}

export default function HomeDashboardClient() {
  const router = useRouter();
  const { playStream } = useLivePlayer();
  const { bookmarks, isBookmarked, toggle: toggleBookmark } = useBookmarks();
  const { isAttending, toggle: toggleAttendance } = useAttendance();

  // Autentikasi Supabase
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleInfo, setRoleInfo] = useState<UserRoleInfo | null>(null);
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isNotifSheetOpen, setIsNotifSheetOpen] = useState(false);

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
  const [locationName, setLocationName] = useState<string>('Kemenag RI');

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = localStorage.getItem('user_last_location');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
            setUserLocation(parsed);
            setLocationName(parsed.cityName || 'Lokasi GPS');
          }
        }
      } catch {}
    });
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
        setLocationName('Lokasi GPS');
        setIsLocating(false);
        try {
          localStorage.setItem(
            'user_last_location',
            JSON.stringify({ ...coords, cityName: 'Lokasi GPS' })
          );
        } catch {}
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Jadwal Waktu Sholat Kemenag RI (Update setiap 1 detik untuk countdown halus)
  const [nowDate, setNowDate] = useState<Date>(() => new Date());
  const [prayerSchedule, setPrayerSchedule] = useState<DailyPrayerTimes>(() =>
    getPrayerScheduleAndNext(userLocation?.lat || -6.2, userLocation?.lng || 106.816666)
  );

  useEffect(() => {
    const updatePrayer = () => {
      const current = new Date();
      setNowDate(current);
      const lat = userLocation?.lat ?? -6.2;
      const lng = userLocation?.lng ?? 106.816666;
      setPrayerSchedule(getPrayerScheduleAndNext(lat, lng, current));
    };
    updatePrayer();
    const interval = setInterval(updatePrayer, 1000);
    return () => clearInterval(interval);
  }, [userLocation]);

  // Konteks Waktu Harian (Pagi vs Petang/Malam)
  const isAfternoonOrEvening = useMemo(() => {
    const hour = nowDate.getHours();
    return hour >= 15 || hour < 3;
  }, [nowDate]);

  const isNearPrayerTime = prayerSchedule.nextPrayer.minutesRemaining <= 25;

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

  // Artikel Pilihan (3 item list vertikal)
  const [featuredArticles, setFeaturedArticles] = useState<IslamicArticle[]>([]);
  const [isArticlesLoading, setIsArticlesLoading] = useState(true);

  useEffect(() => {
    async function loadLatestArticles() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .eq('is_published', true)
          .order('published_at', { ascending: false })
          .limit(3);

        if (!error && data && data.length > 0) {
          const typedData = data as unknown as Array<{
            id: string;
            title: string;
            slug: string;
            summary: string | null;
            source_slug?: string | null;
            source_name: string | null;
            source_url: string | null;
            author_name: string | null;
            read_time_minutes: number | null;
            published_at: string | null;
            image_url: string | null;
          }>;

          setFeaturedArticles(
            typedData.map((d) => ({
              id: d.id,
              title: d.title,
              slug: d.slug,
              summary: d.summary || '',
              contentHtml: '',
              canonicalUrl: '',
              sourceId: d.source_slug || 'portal',
              sourceName: d.source_name || 'Portal Sunnah',
              sourceUrl: d.source_url || '',
              authorName: d.author_name || 'Asatidzah Ahlus Sunnah',
              category: 'umum',
              tags: [],
              imageUrl: d.image_url || undefined,
              publishedAt: d.published_at || new Date().toISOString(),
              readTimeMinutes: d.read_time_minutes || 4,
            }))
          );
        } else {
          setFeaturedArticles(INITIAL_ARTICLES.slice(0, 3));
        }
      } catch {
        setFeaturedArticles(INITIAL_ARTICLES.slice(0, 3));
      }
    }
    loadLatestArticles().finally(() => setIsArticlesLoading(false));
  }, []);

  // Data Kajian (TanStack Query)
  const { sessions, isLoading: isSessionsLoading } = useActiveSessionsQuery({
    currentUserRole: isAdmin ? 'admin' : 'user',
  });

  // Filter Chip State untuk Seksi "Kajian untuk Anda hari ini"
  const [activeKajianChip, setActiveKajianChip] = useState<HomeKajianChip>('hari_ini');

  const handleSelectChip = (chip: HomeKajianChip) => {
    setActiveKajianChip(chip);
    if (chip === 'dekat_saya' && !userLocation && !isLocating) {
      requestUserLocation();
    }
  };

  // Evaluasi dan prioritas kajian sesuai chip dan konteks waktu
  const { filteredKajianList, totalTodayCount, isShowingUpcomingFallback } = useMemo(() => {
    const allEvaluated = evaluateAndQuerySessions(sessions, {
      filter: { placement: 'all' },
      sort: { userLocation, mode: 'auto' },
    });

    const todayActive = allEvaluated.filter((item) => (item.isToday || item.isLive) && !item.isPast);

    // Helper prioritas: kajian yang sudah diikuti (Hadir) atau disimpan (Bookmark) naik ke urutan atas
    const prioritizePersonal = (list: EvaluatedStudySession[]) => {
      return [...list].sort((a, b) => {
        const aPersonal = isAttending(a.session.id) || isBookmarked(a.session.id) ? 1 : 0;
        const bPersonal = isAttending(b.session.id) || isBookmarked(b.session.id) ? 1 : 0;
        if (aPersonal !== bPersonal) return bPersonal - aPersonal;
        if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
        return 0;
      });
    };

    if (activeKajianChip === 'dekat_saya') {
      const nearby = evaluateAndQuerySessions(sessions, {
        filter: { placement: 'map' },
        sort: { userLocation, mode: 'distance' },
      }).filter((item) => !item.isPast);
      return {
        filteredKajianList: nearby,
        totalTodayCount: todayActive.length || nearby.length,
        isShowingUpcomingFallback: false,
      };
    }

    if (activeKajianChip === 'online') {
      const onlineOnly = allEvaluated.filter(
        (item) => !item.isPast && (item.session.is_online || Boolean(item.session.stream_url))
      );
      return {
        filteredKajianList: prioritizePersonal(onlineOnly),
        totalTodayCount: todayActive.length || onlineOnly.length,
        isShowingUpcomingFallback: false,
      };
    }

    if (activeKajianChip === 'tersimpan') {
      const savedOnly = allEvaluated.filter((item) => isBookmarked(item.session.id));
      return {
        filteredKajianList: savedOnly,
        totalTodayCount: todayActive.length,
        isShowingUpcomingFallback: false,
      };
    }

    // Default: 'hari_ini' (Jika malam/kosong, tampilkan kajian esok/mendatang)
    if (todayActive.length > 0) {
      return {
        filteredKajianList: prioritizePersonal(todayActive),
        totalTodayCount: todayActive.length,
        isShowingUpcomingFallback: false,
      };
    }

    const upcoming = allEvaluated.filter((item) => !item.isPast);
    return {
      filteredKajianList: prioritizePersonal(upcoming),
      totalTodayCount: upcoming.length,
      isShowingUpcomingFallback: upcoming.length > 0,
    };
  }, [sessions, userLocation, activeKajianChip, bookmarks, isAttending, isBookmarked]);

  // Data Live Streaming (TanStack Query)
  const { channels } = useYoutubeChannelsQuery();

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

  // Penanggalan Masehi & Hijriah
  const dateInfo = useMemo(() => {
    const d = new Date();
    const fullMasehi = d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const shortMasehi = d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
    const hijri = getHijriDate(d);
    return {
      fullMasehi,
      shortMasehi,
      hijriFormatted: hijri.formatted,
      fastingInfo: hijri.fastingInfo,
    };
  }, []);

  // Nama sapaan pengguna
  const greetingName = useMemo(() => {
    const fullName = currentUser?.user_metadata?.full_name || currentUser?.name;
    if (fullName && typeof fullName === 'string') {
      return fullName.trim().split(/\s+/)[0];
    }
    if (currentUser?.email) {
      return currentUser.email.split('@')[0];
    }
    return 'Penuntut Ilmu';
  }, [currentUser]);

  const primaryLiveStream = activeLiveStreams[0] || null;

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans flex flex-col selection:bg-[#126947]/20 selection:text-[#126947] dark:selection:text-emerald-200 pb-[calc(88px+env(safe-area-inset-bottom,16px))] md:pb-12">
      {/* NAVBAR DESKTOP (Hanya tampil di layar md ke atas) */}
      <header className="hidden md:block sticky top-0 z-40 w-full bg-surface-container-lowest/90 backdrop-blur-md border-b border-outline-variant/25 transition-colors">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo.png?v=3"
              alt="Peta Kajian Logo"
              className="w-9 h-9 rounded-xl object-contain shadow-2xs group-hover:scale-105 transition-transform"
            />
            <span className="font-extrabold text-[16px] tracking-tight text-on-surface">
              Peta Kajian
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-[12px] font-bold text-on-surface-variant">
            <Link
              href="/"
              className="px-3.5 py-2 rounded-xl bg-[#e4eee8] dark:bg-emerald-950/70 text-[#126947] dark:text-emerald-300 font-extrabold"
            >
              Beranda
            </Link>
            <Link
              href="/peta"
              className="px-3.5 py-2 rounded-xl hover:bg-surface-container-low hover:text-on-surface transition-colors"
            >
              Kajian
            </Link>
            <Link
              href="/live"
              className="px-3.5 py-2 rounded-xl hover:bg-surface-container-low hover:text-on-surface transition-colors flex items-center gap-1.5"
            >
              <span>Live</span>
              {activeLiveStreams.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </Link>
            <Link
              href="/masjid"
              className="px-3.5 py-2 rounded-xl hover:bg-surface-container-low hover:text-on-surface transition-colors"
            >
              Masjid
            </Link>
            <Link
              href={currentUser ? '/kontributor/profile' : '/login'}
              className="px-3.5 py-2 rounded-xl hover:bg-surface-container-low hover:text-on-surface transition-colors"
            >
              Profil
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={requestUserLocation}
              disabled={isLocating}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/25 transition-colors cursor-pointer"
              title={`Perbarui lokasi GPS (${locationName})`}
              aria-label="Perbarui lokasi GPS"
            >
              <span
                className={`material-symbols-outlined text-[18px] text-[#126947] dark:text-emerald-400 ${
                  isLocating ? 'animate-spin' : ''
                }`}
              >
                {isLocating ? 'progress_activity' : 'near_me'}
              </span>
            </button>
            <ThemeToggle
              variant="icon"
              className="!w-10 !h-10 !rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/25"
            />
          </div>
        </div>
      </header>

      {/* CONTAINER UTAMA BERANDA (Margin 16px, Jarak Antar Section 24px) */}
      <main className="w-full max-w-xl md:max-w-3xl mx-auto px-4 pt-4 sm:pt-6 space-y-6">
        {/* =========================================================
            1. HEADER RINGKAS: Tanggal, Salam, Notifikasi/Tema, Search
           ========================================================= */}
        <section className="space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p
                suppressHydrationWarning
                className="text-[12px] font-medium text-on-surface-variant truncate"
              >
                {dateInfo.fullMasehi} &middot; {dateInfo.hijriFormatted}
              </p>
              <h1 className="text-[24px] font-extrabold text-on-surface tracking-tight leading-[1.25] mt-0.5">
                Assalamu&apos;alaikum, {greetingName}
              </h1>
            </div>

            {/* Ikon Notifikasi & Mode Gelap (Minimal 44x44px Touch Target) */}
            <div className="flex items-center gap-2 shrink-0 pt-1">
              <button
                type="button"
                onClick={() => setIsNotifSheetOpen((prev) => !prev)}
                className="relative w-11 h-11 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/25 shadow-2xs flex items-center justify-center text-on-surface transition-all cursor-pointer active:scale-95"
                title="Pengingat Sholat, Puasa & Lokasi"
                aria-label="Pengingat dan Lokasi"
                aria-expanded={isNotifSheetOpen}
              >
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                {(dateInfo.fastingInfo || isNearPrayerTime) && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#126947] dark:bg-emerald-400" />
                )}
              </button>

              <ThemeToggle
                variant="icon"
                className="!w-11 !h-11 !rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low !border !border-outline-variant/25 shadow-2xs"
              />
            </div>
          </div>

          {/* Panel Ringkas Pengingat & Lokasi (Saat ikon lonceng diketuk) */}
          {isNotifSheetOpen && (
            <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-[#126947] dark:text-emerald-400">
                    notifications_active
                  </span>
                  Asisten Harian &amp; Lokasi
                </span>
                <button
                  type="button"
                  onClick={() => setIsNotifSheetOpen(false)}
                  className="text-[12px] font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  Tutup
                </button>
              </div>

              {dateInfo.fastingInfo && !dateInfo.fastingInfo.isForbidden && (
                <Link
                  href="/kalender"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#e4eee8]/70 dark:bg-emerald-950/50 text-[#126947] dark:text-emerald-300 text-[12px] font-semibold"
                >
                  <span>Hari ini: {dateInfo.fastingInfo.label}</span>
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </Link>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="text-[12px] text-on-surface-variant truncate">
                  Zona waktu: <strong className="text-on-surface">{prayerSchedule.timezoneLabel} &middot; {locationName}</strong>
                </div>
                <button
                  type="button"
                  onClick={requestUserLocation}
                  disabled={isLocating}
                  className="px-3 py-1.5 rounded-xl bg-[#126947] text-white text-[12px] font-bold flex items-center gap-1 shrink-0 cursor-pointer active:scale-95 disabled:opacity-60"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isLocating ? 'animate-spin' : ''}`}>
                    {isLocating ? 'progress_activity' : 'my_location'}
                  </span>
                  <span>Perbarui GPS</span>
                </button>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kajian, ustadz, atau masjid..."
              className="w-full h-12 pl-11 pr-10 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-2xs focus:outline-none focus:border-[#126947] focus:ring-2 focus:ring-[#126947]/15 text-[14px] text-on-surface placeholder:text-on-surface-variant/70 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                aria-label="Bersihkan pencarian"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </form>
        </section>

        {/* =========================================================
            2. KARTU HERO WAKTU SHOLAT (Anchor Utama)
           ========================================================= */}
        <section
          aria-label="Jadwal Waktu Sholat"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#167952] via-[#126947] to-[#0d5237] dark:from-[#136645] dark:via-[#0f5439] dark:to-[#093b27] text-white p-5 sm:p-6 shadow-sm"
        >
          {/* Pola Geometris Islami Tipis di Latar Belakang */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='48' height='48' viewBox='0 0 48 48' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1'%3E%3Cpath d='M24 0 L48 24 L24 48 L0 24 Z'/%3E%3Cpath d='M24 8 L40 24 L24 40 L8 24 Z'/%3E%3Ccircle cx='24' cy='24' r='3'/%3E%3C/g%3E%3C/svg%3E")`,
              backgroundSize: '48px 48px',
            }}
          />

          <div className="relative z-10 space-y-4">
            {/* Baris Atas: Label Menuju Sholat & Badge Zona Waktu */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  suppressHydrationWarning
                  className="text-[12px] font-bold uppercase tracking-wider text-white/95 truncate"
                >
                  MENUJU {prayerSchedule.nextPrayer.name.toUpperCase()} &middot;{' '}
                  {prayerSchedule.nextPrayer.time}
                </span>
                {isNearPrayerTime && (
                  <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping shrink-0" />
                )}
              </div>

              <button
                type="button"
                onClick={requestUserLocation}
                disabled={isLocating}
                className="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-xs text-[12px] font-semibold text-white/95 transition-colors shrink-0 cursor-pointer"
                title="Ketuk untuk memperbarui lokasi GPS waktu sholat"
              >
                {prayerSchedule.timezoneLabel} &middot; {locationName}
              </button>
            </div>

            {/* Countdown Dominan (Berdetak Halus Setiap Detik - Skala 24px) */}
            <div
              suppressHydrationWarning
              className="flex items-baseline flex-wrap gap-y-1 pt-0.5 pb-1"
            >
              {prayerSchedule.nextPrayer.hoursPart > 0 && (
                <div className="flex items-baseline mr-3">
                  <span
                    suppressHydrationWarning
                    className="text-[24px] font-extrabold tracking-tight tabular-nums leading-none"
                  >
                    {prayerSchedule.nextPrayer.hoursPart}
                  </span>
                  <span className="text-[14px] font-medium text-white/85 ml-1.5">
                    jam
                  </span>
                </div>
              )}

              <div className="flex items-baseline mr-3">
                <span
                  suppressHydrationWarning
                  className="text-[24px] font-extrabold tracking-tight tabular-nums leading-none"
                >
                  {String(prayerSchedule.nextPrayer.minutesPart).padStart(2, '0')}
                </span>
                <span className="text-[14px] font-medium text-white/85 ml-1.5">
                  menit
                </span>
              </div>

              <div className="flex items-baseline">
                <span
                  suppressHydrationWarning
                  className="text-[24px] font-extrabold tracking-tight tabular-nums leading-none text-white/95"
                >
                  {String(prayerSchedule.nextPrayer.secondsPart).padStart(2, '0')}
                </span>
                <span className="text-[12px] font-medium text-white/80 ml-1">
                  detik
                </span>
              </div>
            </div>

            {/* Lima Waktu Sholat dalam Satu Baris Kecil */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5 text-center">
              {(
                [
                  { id: 'subuh', label: 'Subuh', time: prayerSchedule.subuh },
                  { id: 'dzuhur', label: 'Dzuhur', time: prayerSchedule.dzuhur },
                  { id: 'ashar', label: 'Ashar', time: prayerSchedule.ashar },
                  { id: 'maghrib', label: 'Maghrib', time: prayerSchedule.maghrib },
                  { id: 'isya', label: 'Isya', time: prayerSchedule.isya },
                ] as const
              ).map((item) => {
                const isNext = prayerSchedule.nextPrayer.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col items-center justify-center py-2.5 sm:py-3 px-1 rounded-2xl transition-all ${
                      isNext
                        ? 'bg-white text-[#0d4f35] shadow-sm font-extrabold'
                        : 'bg-white/12 border border-white/10 text-white'
                    }`}
                  >
                    <span
                      className={`text-[12px] leading-tight ${
                        isNext ? 'font-bold text-[#0d4f35]/85' : 'font-medium text-white/80'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span
                      className={`text-[14px] mt-1 tracking-tight tabular-nums ${
                        isNext ? 'font-extrabold text-[#0d4f35]' : 'font-bold text-white'
                      }`}
                    >
                      {item.time}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Dua Aksi Cepat Peka Waktu di Dalam Kartu Hero */}
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              <Link
                href="/sholat?tab=kiblat"
                className="min-h-[44px] py-2.5 px-3 rounded-2xl bg-white/12 hover:bg-white/20 border border-white/15 flex items-center justify-center gap-2 text-[14px] font-bold text-white transition-all active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[18px]">explore</span>
                <span>Arah Kiblat</span>
              </Link>

              <Link
                href="/dzikir"
                className="min-h-[44px] py-2.5 px-3 rounded-2xl bg-white/12 hover:bg-white/20 border border-white/15 flex items-center justify-center gap-2 text-[14px] font-bold text-white transition-all active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[18px]">wb_twilight</span>
                <span>{isAfternoonOrEvening ? 'Dzikir Petang' : 'Dzikir Pagi'}</span>
              </Link>
            </div>
          </div>
        </section>

        {/* =========================================================
            3. LIVE NOW STRIP (Kondisional: Hanya Muncul Jika Ada Siaran)
           ========================================================= */}
        {primaryLiveStream && (
          <section aria-label="Siaran Langsung Saat Ini">
            <div className="rounded-2xl bg-[#fbeeee] dark:bg-red-950/35 border border-red-200/80 dark:border-red-800/40 p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-2xs">
              <Link
                href="/live"
                className="flex items-center gap-3 min-w-0 flex-1 group"
              >
                {/* Titik Merah Berkedip */}
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-extrabold uppercase tracking-wider text-red-700 dark:text-red-400 truncate">
                    LIVE SEKARANG &middot; {activeLiveStreams.length} SIARAN
                  </p>
                  <h2 className="text-[16px] font-bold text-on-surface group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors truncate mt-0.5">
                    {primaryLiveStream.title}
                  </h2>
                  <p className="text-[12px] text-on-surface-variant truncate">
                    {primaryLiveStream.channelName}
                  </p>
                </div>
              </Link>

              <button
                type="button"
                onClick={() =>
                  playStream({
                    videoId: primaryLiveStream.videoId,
                    title: primaryLiveStream.title,
                    channelName: primaryLiveStream.channelName,
                    speakerName: primaryLiveStream.speakerName,
                  })
                }
                className="min-h-[44px] px-4 py-2 rounded-full bg-[#d92d20] hover:bg-red-700 text-white text-[14px] font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <span
                  className="material-symbols-outlined text-[16px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  play_arrow
                </span>
                <span>Tonton</span>
              </button>
            </div>
          </section>
        )}

        {/* =========================================================
            4. QUICK ACCESS: SATU BARIS 5 IKON (Seragam Hijau, Tanpa Warna-Warni)
           ========================================================= */}
        <section aria-label="Akses Cepat" className="grid grid-cols-5 gap-2 sm:gap-3">
          <Link
            href="/peta"
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#e4eee8] dark:bg-emerald-950/60 border border-[#126947]/10 dark:border-emerald-400/15 text-[#126947] dark:text-emerald-300 flex items-center justify-center group-hover:bg-[#d6e6dc] dark:group-hover:bg-emerald-900/60 transition-all active:scale-95">
              <span className="material-symbols-outlined text-[24px]">map</span>
            </div>
            <span className="text-[12px] font-semibold text-on-surface text-center leading-tight">
              Peta Kajian
            </span>
          </Link>

          <Link
            href="/masjid"
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#e4eee8] dark:bg-emerald-950/60 border border-[#126947]/10 dark:border-emerald-400/15 text-[#126947] dark:text-emerald-300 flex items-center justify-center group-hover:bg-[#d6e6dc] dark:group-hover:bg-emerald-900/60 transition-all active:scale-95">
              <span className="material-symbols-outlined text-[24px]">mosque</span>
            </div>
            <span className="text-[12px] font-semibold text-on-surface text-center leading-tight">
              Masjid
            </span>
          </Link>

          <Link
            href="/doa"
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#e4eee8] dark:bg-emerald-950/60 border border-[#126947]/10 dark:border-emerald-400/15 text-[#126947] dark:text-emerald-300 flex items-center justify-center group-hover:bg-[#d6e6dc] dark:group-hover:bg-emerald-900/60 transition-all active:scale-95">
              <span className="material-symbols-outlined text-[24px]">menu_book</span>
            </div>
            <span className="text-[12px] font-semibold text-on-surface text-center leading-tight">
              Doa Harian
            </span>
          </Link>

          <Link
            href="/sifat-sholat"
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#e4eee8] dark:bg-emerald-950/60 border border-[#126947]/10 dark:border-emerald-400/15 text-[#126947] dark:text-emerald-300 flex items-center justify-center group-hover:bg-[#d6e6dc] dark:group-hover:bg-emerald-900/60 transition-all active:scale-95">
              <span className="material-symbols-outlined text-[24px]">accessibility_new</span>
            </div>
            <span className="text-[12px] font-semibold text-on-surface text-center leading-tight">
              Panduan Sholat
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(true)}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#e4eee8] dark:bg-emerald-950/60 border border-[#126947]/10 dark:border-emerald-400/15 text-[#126947] dark:text-emerald-300 flex items-center justify-center group-hover:bg-[#d6e6dc] dark:group-hover:bg-emerald-900/60 transition-all active:scale-95">
              <span className="material-symbols-outlined text-[24px]">grid_view</span>
            </div>
            <span className="text-[12px] font-semibold text-on-surface text-center leading-tight">
              Semua
            </span>
          </button>
        </section>

        {/* =========================================================
            5. KAJIAN UNTUK ANDA HARI INI (Konten Inti, Dinaikkan)
           ========================================================= */}
        <section aria-labelledby="kajian-hari-ini-heading" className="space-y-3.5">
          {/* Header Seksi */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2
                id="kajian-hari-ini-heading"
                className="text-[18px] font-extrabold text-on-surface tracking-tight"
              >
                {isShowingUpcomingFallback && activeKajianChip === 'hari_ini'
                  ? 'Kajian untuk Anda besok'
                  : 'Kajian untuk Anda hari ini'}
              </h2>
              <p
                suppressHydrationWarning
                className="text-[12px] text-on-surface-variant mt-0.5"
              >
                {filteredKajianList.length} agenda &middot; {dateInfo.shortMasehi}
              </p>
            </div>

            <Link
              href="/peta"
              className="min-h-[36px] inline-flex items-center gap-1 text-[12px] font-bold text-[#126947] dark:text-emerald-400 hover:underline shrink-0 pt-0.5"
            >
              <span>Lihat di peta</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>

          {/* Filter Chips: Hari ini · Dekat saya · Online · Tersimpan */}
          <div
            role="tablist"
            aria-label="Filter kajian beranda"
            className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5"
          >
            {(
              [
                { id: 'hari_ini', label: 'Hari ini' },
                { id: 'dekat_saya', label: 'Dekat saya' },
                { id: 'online', label: 'Online' },
                { id: 'tersimpan', label: 'Tersimpan' },
              ] as const
            ).map((chip) => {
              const isSelected = activeKajianChip === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleSelectChip(chip.id)}
                  className={`min-h-[42px] px-4 py-2 rounded-full text-[14px] transition-all shrink-0 cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-[#126947] text-white font-bold shadow-2xs'
                      : 'bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-semibold border border-outline-variant/30'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* Daftar Kartu Vertikal (Maksimal 3 Item) */}
          {isSessionsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <HomeKajianCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredKajianList.length === 0 ? (
            <div className="p-6 text-center rounded-2xl border border-outline-variant/25 bg-surface-container-lowest text-on-surface-variant space-y-2">
              <span className="material-symbols-outlined text-[32px] text-outline">
                {activeKajianChip === 'tersimpan' ? 'bookmark_border' : 'event_busy'}
              </span>
              <p className="text-[14px] font-bold text-on-surface">
                {activeKajianChip === 'tersimpan'
                  ? 'Belum ada kajian yang disimpan'
                  : activeKajianChip === 'online'
                  ? 'Belum ada kajian online aktif saat ini'
                  : 'Belum ada agenda kajian untuk filter ini'}
              </p>
              <p className="text-[12px] text-on-surface-variant">
                {activeKajianChip === 'tersimpan'
                  ? 'Ketuk tombol Simpan pada kartu kajian untuk menyimpannya di beranda Anda.'
                  : 'Jelajahi seluruh jadwal kajian di Peta Kajian.'}
              </p>
              {activeKajianChip !== 'hari_ini' && (
                <button
                  type="button"
                  onClick={() => setActiveKajianChip('hari_ini')}
                  className="mt-1 inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300 text-[12px] font-bold cursor-pointer"
                >
                  Kembali ke Hari ini
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredKajianList.slice(0, 3).map(({ session, formattedSchedule, distanceKm, distanceLabel, isLive }) => {
                const booked = isBookmarked(session.id);
                const attend = isAttending(session.id);

                return (
                  <article
                    key={session.id}
                    className="p-4 rounded-2xl border border-outline-variant/25 bg-surface-container-lowest hover:border-[#126947]/40 shadow-2xs transition-all space-y-3"
                  >
                    {/* Baris Atas: Jam, Jarak / Online, Status Personal */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#126947] dark:text-emerald-300 bg-[#e4eee8] dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          <span>{formattedSchedule}</span>
                        </span>

                        {isLive && (
                          <span className="inline-flex items-center gap-1 text-[12px] font-bold text-red-700 dark:text-red-300 bg-red-500/12 px-2 py-1 rounded-lg">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            <span>Berlangsung</span>
                          </span>
                        )}

                        {session.is_online ? (
                          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-on-surface-variant bg-surface-container-low px-2.5 py-1 rounded-lg">
                            <span className="material-symbols-outlined text-[14px]">videocam</span>
                            <span>Online</span>
                          </span>
                        ) : distanceKm !== null ? (
                          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-on-surface-variant bg-surface-container-low px-2.5 py-1 rounded-lg">
                            <span className="material-symbols-outlined text-[14px] text-[#126947] dark:text-emerald-400">
                              near_me
                            </span>
                            <span>
                              {distanceLabel ||
                                (distanceKm < 1
                                  ? `${Math.round(distanceKm * 1000)} m`
                                  : `${distanceKm.toFixed(1)} km`)}
                            </span>
                          </span>
                        ) : null}
                      </div>

                      {(booked || attend) && (
                        <span className="text-[12px] font-bold text-[#126947] dark:text-emerald-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">verified</span>
                          <span>Diikuti</span>
                        </span>
                      )}
                    </div>

                    {/* Judul Penuh (2 Baris), Ustadz, dan Lokasi */}
                    <div className="space-y-1.5">
                      <Link
                        href={`/peta?session=${session.id}`}
                        className="font-bold text-[16px] text-on-surface hover:text-[#126947] dark:hover:text-emerald-400 transition-colors line-clamp-2 leading-snug block"
                      >
                        {session.title}
                      </Link>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-[14px] text-on-surface-variant pt-0.5">
                        <div className="flex items-center gap-1.5 font-semibold text-on-surface/90 min-w-0">
                          <span className="material-symbols-outlined text-[16px] text-[#126947] dark:text-emerald-400 shrink-0">
                            person
                          </span>
                          <span className="truncate">{session.speaker_name}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-on-surface-variant min-w-0">
                          <span className="material-symbols-outlined text-[16px] text-outline shrink-0">
                            {session.is_online ? 'language' : 'location_on'}
                          </span>
                          <span className="truncate">
                            {session.is_online
                              ? 'Siaran Kajian Online'
                              : session.venues?.name || 'Lokasi Masjid'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Baris Aksi Bawah: Tombol Hadir, Simpan, dan Detail Peta (Min 44px Touch Target) */}
                    <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-outline-variant/20">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleAttendance(session.id)}
                          className={`min-h-[44px] inline-flex items-center gap-1.5 text-[14px] font-bold px-3.5 py-2 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                            attend
                              ? 'bg-[#126947] text-white border-[#126947]'
                              : 'bg-[#e4eee8]/70 dark:bg-emerald-950/50 hover:bg-[#e4eee8] border-transparent text-[#126947] dark:text-emerald-300'
                          }`}
                        >
                          <span
                            className="material-symbols-outlined text-[16px]"
                            style={{ fontVariationSettings: attend ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            {attend ? 'check_circle' : 'how_to_reg'}
                          </span>
                          <span>Hadir</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleBookmark(session.id)}
                          className={`min-h-[44px] inline-flex items-center gap-1.5 text-[14px] font-bold px-3.5 py-2 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                            booked
                              ? 'bg-[#e4eee8] dark:bg-emerald-950/80 text-[#126947] dark:text-emerald-300 border-[#126947]/30'
                              : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant border-outline-variant/25'
                          }`}
                        >
                          <span
                            className="material-symbols-outlined text-[16px]"
                            style={{ fontVariationSettings: booked ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            bookmark
                          </span>
                          <span>{booked ? 'Tersimpan' : 'Simpan'}</span>
                        </button>
                      </div>

                      <Link
                        href={`/peta?session=${session.id}`}
                        className="min-h-[44px] inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[14px] font-bold text-[#126947] dark:text-emerald-400 hover:bg-surface-container-low transition-colors shrink-0"
                      >
                        <span>Detail</span>
                        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                      </Link>
                    </div>
                  </article>
                );
              })}

              {filteredKajianList.length > 3 && (
                <Link
                  href="/peta"
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/25 text-[14px] font-bold text-[#126947] dark:text-emerald-400 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                >
                  <span>Lihat semua {filteredKajianList.length} agenda kajian di peta</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              )}
            </div>
          )}
        </section>

        {/* =========================================================
            6. RENUNGAN HARIAN (Satu Kartu Hadits dengan Tipografi Serif)
           ========================================================= */}
        <DailyHadithCard />

        {/* =========================================================
            7. ARTIKEL PILIHAN (3 Kartu List dengan Thumbnail Kecil di Kiri)
           ========================================================= */}
        <section aria-labelledby="artikel-pilihan-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2
              id="artikel-pilihan-heading"
              className="text-[18px] font-extrabold text-on-surface tracking-tight"
            >
              Artikel pilihan
            </h2>

            <Link
              href="/artikel"
              className="min-h-[36px] inline-flex items-center gap-1 text-[12px] font-bold text-[#126947] dark:text-emerald-400 hover:underline shrink-0"
            >
              <span>Lihat semua</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>

          <div className="space-y-3">
            {isArticlesLoading
              ? Array.from({ length: 3 }).map((_, idx) => <HomeArticleCardSkeleton key={idx} />)
              : featuredArticles.slice(0, 3).map((art, idx) => (
                  <HomeArticleListItem key={art.id} art={art} index={idx} />
                ))}
          </div>
        </section>
      </main>

      {/* FOOTER DESKTOP */}
      <footer className="hidden md:block mt-12 border-t border-outline-variant/25 bg-surface-container-low py-6 text-[12px] text-on-surface-variant">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png?v=3" alt="Logo" className="w-5 h-5 rounded-md object-contain" />
            <span className="font-bold text-on-surface">Peta Kajian Indonesia</span>
          </div>
          <p className="text-[12px] text-outline">
            &copy; {new Date().getFullYear()} Peta Kajian Indonesia
          </p>
        </div>
      </footer>

      {/* Bottom Sheet Menu Lengkap ("Semua") */}
      <MoreMenuBottomSheet
        isOpen={isMoreMenuOpen}
        onClose={() => setIsMoreMenuOpen(false)}
        currentUser={currentUser}
        isAdmin={isAdmin}
        userRole={roleInfo?.role}
        onOpenRequestContributor={() => setIsRequestModalOpen(true)}
      />

      {/* Modal Navigasi Mobile Drawer */}
      <MobileNavDrawer
        isOpen={isNavDrawerOpen}
        onClose={() => setIsNavDrawerOpen(false)}
        currentUser={currentUser}
        isAdmin={isAdmin}
        onOpenRequestContributor={() => setIsRequestModalOpen(true)}
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

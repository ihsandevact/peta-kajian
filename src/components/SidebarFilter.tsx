import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import type { FilterState } from '@/components/HomeClient';
import { type StudySession } from '@/lib/services/kajian';
import { type EvaluatedStudySession } from '@/lib/domain/kajianQuery';
import SkeletonCard from './SkeletonCard';
import { calculateDistance } from '@/utils/distance';
import RegionPickerModal from './RegionPickerModal';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { useBookmarks } from '@/utils/bookmarks';
import { triggerLoginNudge } from '@/components/LoginNudgePrompt';
import { useDebounce } from '@/lib/hooks/useDebounce';

interface SidebarFilterProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  sessions: StudySession[];
  evaluatedSessions?: EvaluatedStudySession[];
  allSessions?: StudySession[];
  selectedSession: StudySession | null;
  onSelectSession: (s: StudySession | null) => void;
  isLoading?: boolean;
  userLocation?: { lat: number; lng: number } | null;
  onRequestLocation?: () => void;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  currentUser?: any;
  hasConnectionError?: boolean;
  isOffline?: boolean;
}

/**
 * Ekstrak YouTube Video ID dari URL stream (untuk fallback thumbnail otomatis)
 */
function extractYoutubeVideoId(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

interface KajianSidebarCardProps {
  session: StudySession;
  evaluated?: EvaluatedStudySession;
  isSelected: boolean;
  isBookmarked: boolean;
  distanceLabel: string | null;
  onSelect: (session: StudySession) => void;
  onToggleBookmark: (sessionId: string, session: StudySession) => void;
  currentUser: any;
}

const KajianSidebarCard = React.memo(
  function KajianSidebarCard({
    session,
    evaluated,
    isSelected,
    isBookmarked,
    distanceLabel,
    onSelect,
    onToggleBookmark,
    currentUser,
  }: KajianSidebarCardProps) {
    const info = React.useMemo(() => {
      if (evaluated) {
        return {
          dateLabel: evaluated.formattedSchedule,
          isLive: evaluated.isLive,
          isPast: evaluated.isPast && !session.is_recurring,
          isToday:
            (evaluated.isToday || evaluated.isLive) &&
            !(evaluated.isPast && !session.is_recurring),
        };
      }
      const rawInfo = getEffectiveSessionInfo(session, new Date());
      const isPast = rawInfo.isPast && !session.is_recurring;
      return {
        dateLabel: rawInfo.dateLabel,
        isLive: rawInfo.isLive,
        isPast,
        isToday: (rawInfo.isToday || rawInfo.isLive) && !isPast,
      };
    }, [session, evaluated]);

    // Tentukan URL thumbnail (Prioritas: poster_url -> YouTube thumbnail dari stream_url -> null)
    const thumbnailUrl = React.useMemo(() => {
      const rawPoster = session.poster_url?.trim();
      if (
        rawPoster &&
        rawPoster !== '' &&
        rawPoster.toLowerCase() !== 'null' &&
        rawPoster.toLowerCase() !== 'undefined'
      ) {
        return rawPoster;
      }
      const ytId = extractYoutubeVideoId(session.stream_url);
      if (ytId) {
        return `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`;
      }
      return null;
    }, [session.poster_url, session.stream_url]);

    const [imgError, setImgError] = React.useState(false);
    const [imgLoaded, setImgLoaded] = React.useState(false);

    React.useEffect(() => {
      setImgError(false);
      setImgLoaded(false);
    }, [session.id, thumbnailUrl]);

    const isLive = info.isLive;
    const isPast = info.isPast;
    const isToday = info.isToday;
    const isRutin = session.is_recurring;
    const isAkhwatOnly = session.audience_type === 'akhwat';

    const hasValidImage = Boolean(thumbnailUrl && !imgError);

    // Sembunyikan nama kitab jika kosong atau sudah tertulis sama persis di dalam judul kajian
    const showDistinctBookTitle = React.useMemo(() => {
      const rawBook = session.book_title?.trim();
      if (!rawBook || rawBook === '' || rawBook.toLowerCase() === 'null') return false;
      const normBook = rawBook.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normTitle = (session.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!normBook) return false;
      return !normTitle.includes(normBook);
    }, [session.book_title, session.title]);

    return (
      <div
        data-id={session.id}
        onClick={() => onSelect(session)}
        className={`cursor-pointer p-3.5 rounded-2xl transition-colors relative border overflow-hidden group ${
          isSelected
            ? 'bg-[#f1f7f3] dark:bg-[#13281f] border-[#126947] ring-1 ring-[#126947]/30 shadow-xs'
            : isPast
            ? 'bg-surface-container-lowest border-outline-variant/20 opacity-80 hover:opacity-100 hover:border-outline-variant/40'
            : 'bg-surface-container-lowest border-outline-variant/25 hover:border-[#126947]/40 shadow-2xs'
        }`}
      >
        {/* 1. Baris Header Full-Width: Status + Jadwal + Jarak di Kiri, Tombol Bookmark di Kanan */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
            {isLive ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-extrabold uppercase tracking-wider shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                LIVE
              </span>
            ) : isToday ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-bold uppercase tracking-wider shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Hari Ini
              </span>
            ) : isRutin ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/12 text-sky-700 dark:text-sky-300 text-[10px] font-bold uppercase tracking-wider shrink-0">
                Rutin
              </span>
            ) : isPast ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-container text-on-surface-variant text-[10px] font-bold uppercase tracking-wider shrink-0">
                Selesai
              </span>
            ) : null}

            {isAkhwatOnly && (
              <span className="px-2 py-0.5 rounded-lg bg-pink-500/12 text-pink-700 dark:text-pink-300 text-[10px] font-bold uppercase tracking-wider shrink-0">
                Akhwat
              </span>
            )}

            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#e4eee8] text-[#126947] dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px] font-bold min-w-0 truncate"
              title={info.dateLabel}
            >
              <span className="material-symbols-outlined text-[13px] shrink-0">schedule</span>
              <span className="truncate">{info.dateLabel}</span>
            </span>

            {distanceLabel && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-surface-container-low border border-outline-variant/20 text-on-surface-variant text-[10px] font-bold shrink-0">
                <span className="material-symbols-outlined text-[12px] text-[#126947] dark:text-emerald-400">
                  near_me
                </span>
                <span>{distanceLabel}</span>
              </span>
            )}

            {session.is_test && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
                TEST
              </span>
            )}
          </div>

          {/* Tombol Bookmark Minimalis di Kanan Atas Baris Header */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const willBookmark = !isBookmarked;
              onToggleBookmark(session.id, session);
              if (willBookmark && !currentUser) {
                triggerLoginNudge({ type: 'bookmark', title: session.title });
              }
            }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer active:scale-95 shrink-0 ${
              isBookmarked
                ? 'bg-[#e4eee8] dark:bg-emerald-950/80 text-[#126947] dark:text-emerald-300 border border-[#126947]/25'
                : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/20'
            }`}
            title={isBookmarked ? 'Hapus dari Tersimpan' : 'Simpan Kajian'}
            aria-label="Simpan Kajian"
          >
            <span
              className="material-symbols-outlined text-[15px]"
              style={{ fontVariationSettings: isBookmarked ? "'FILL' 1" : "'FILL' 0" }}
            >
              bookmark
            </span>
          </button>
        </div>

        {/* 2. Baris Body: Blok Teks di Kiri + Thumbnail Bersih di Kanan */}
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            {/* Judul Kajian */}
            <h2 className="text-[14px] font-extrabold text-on-surface group-hover:text-[#126947] dark:group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">
              {session.title}
            </h2>

            {/* Nama Pemateri */}
            <div className="flex items-center gap-1.5 text-[12px] text-on-surface/90 font-semibold min-w-0 pt-0.5">
              <span className="material-symbols-outlined text-[14px] text-[#126947] dark:text-emerald-400 shrink-0">
                person
              </span>
              <span className="truncate">{session.speaker_name}</span>
            </div>

            {/* Judul Kitab (Hanya tampil jika berbeda dari judul kajian) */}
            {showDistinctBookTitle && (
              <div
                className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-medium min-w-0"
                title={`Kitab: ${session.book_title}`}
              >
                <span className="material-symbols-outlined text-[13px] shrink-0 text-outline">
                  menu_book
                </span>
                <span className="truncate">{session.book_title}</span>
              </div>
            )}

            {/* Lokasi Masjid / Online */}
            <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant min-w-0">
              <span
                className={`material-symbols-outlined text-[14px] shrink-0 ${
                  session.venues ? 'text-outline' : 'text-rose-500'
                }`}
              >
                {session.venues ? 'location_on' : 'videocam'}
              </span>
              <span className="truncate">
                {session.venues ? session.venues.name : 'Kajian Online · Disiarkan'}
              </span>
            </div>
          </div>

          {/* Thumbnail Poster Bersih Tanpa Tertutup Tombol Bookmark */}
          <div className="w-[70px] h-[70px] sm:w-[74px] sm:h-[74px] rounded-xl overflow-hidden bg-surface-container-low border border-outline-variant/25 shrink-0 relative shadow-2xs">
            {hasValidImage ? (
              <>
                {!imgLoaded && (
                  <div className="absolute inset-0 bg-surface-container-high animate-pulse flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px] text-outline/40">
                      image
                    </span>
                  </div>
                )}
                <img
                  src={thumbnailUrl!}
                  alt={`Poster ${session.title}`}
                  className={`w-full h-full object-cover transition-opacity duration-200 ${
                    imgLoaded ? 'opacity-100' : 'opacity-0'
                  } ${isPast ? 'grayscale-[35%] brightness-90' : ''}`}
                  loading="lazy"
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgError(true)}
                />
              </>
            ) : (
              <div className="w-full h-full bg-[#e4eee8] dark:bg-emerald-950/60 flex flex-col items-center justify-center text-[#126947] dark:text-emerald-300 p-1.5 text-center select-none">
                <span className="material-symbols-outlined text-[22px] opacity-85">
                  {session.venues ? 'mosque' : 'smart_display'}
                </span>
                <span className="text-[8px] font-extrabold uppercase tracking-wider opacity-75 mt-0.5 leading-tight">
                  {session.venues ? 'Majelis' : 'Online'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.isSelected === next.isSelected &&
      prev.isBookmarked === next.isBookmarked &&
      prev.session === next.session &&
      prev.evaluated === next.evaluated &&
      prev.distanceLabel === next.distanceLabel &&
      prev.currentUser === next.currentUser
    );
  }
);

export default function SidebarFilter({
  filters,
  setFilters,
  sessions,
  evaluatedSessions,
  allSessions,
  selectedSession,
  onSelectSession,
  isLoading = false,
  userLocation = null,
  onRequestLocation,
  isRefreshing = false,
  onRefresh,
  currentUser,
  hasConnectionError = false,
  isOffline = false,
}: SidebarFilterProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(15);
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [searchInputValue, setSearchInputValue] = useState(filters.searchQuery);

  const { bookmarks, isBookmarked, toggle: toggleBookmark } = useBookmarks();

  const debouncedSearchInput = useDebounce(searchInputValue, 280);

  useEffect(() => {
    setSearchInputValue(filters.searchQuery);
  }, [filters.searchQuery]);

  useEffect(() => {
    if (debouncedSearchInput !== filters.searchQuery) {
      setFilters((p) => ({ ...p, searchQuery: debouncedSearchInput }));
    }
  }, [debouncedSearchInput, filters.searchQuery, setFilters]);

  useEffect(() => {
    setVisibleCount(15);
  }, [filters, sessions.length]);

  // Dedicated Sentinel IntersectionObserver untuk Infinite Scroll yang halus tanpa layout jump
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scrollRoot = listRef.current;
    if (!sentinel || isLoading || visibleCount >= sessions.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 20, sessions.length));
        }
      },
      {
        root: scrollRoot,
        rootMargin: '420px',
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isLoading, visibleCount, sessions.length]);

  useEffect(() => {
    if (selectedSession && listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-id="${selectedSession.id}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedSession]);

  const Pill = ({
    active,
    label,
    onClick,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors cursor-pointer border active:scale-95 ${
        active
          ? 'bg-[#126947] text-white border-[#126947] shadow-2xs'
          : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-low hover:text-on-surface'
      }`}
    >
      {label}
    </button>
  );

  const hasActiveModalFilters = Boolean(filters.region);

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface overflow-hidden">
      {/* 1. Sticky Header & Filter Controls */}
      <div className="flex p-3 sm:p-4 pb-3 bg-surface-container-lowest border-b border-outline-variant/25 flex-col gap-2.5 shrink-0">
        {/* Desktop Top Row (lg+): Minimalist Title + Count Badge + Region Filter + Refresh */}
        <div className="hidden lg:flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-extrabold text-[15px] text-on-surface tracking-tight leading-tight truncate">
              Jadwal Kajian
            </h1>
            <span
              className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-bold shrink-0"
              suppressHydrationWarning
            >
              {sessions.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsRegionModalOpen(true)}
              className={`h-8 px-3 rounded-full border flex items-center justify-center gap-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
                hasActiveModalFilters
                  ? 'bg-[#126947] text-white border-[#126947] shadow-2xs'
                  : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/30 text-on-surface'
              }`}
              title="Filter Wilayah Kajian"
            >
              <span className="material-symbols-outlined text-[15px]">location_on</span>
              <span className="max-w-[110px] truncate">
                {filters.region ? filters.region.name : 'Pilih Wilayah'}
              </span>
            </button>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="w-8 h-8 rounded-full bg-surface-container-low hover:bg-surface-container border border-outline-variant/25 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer disabled:opacity-50"
                title="Perbarui jadwal kajian"
              >
                <span
                  className={`material-symbols-outlined text-[16px] ${
                    isRefreshing ? 'animate-spin text-[#126947]' : ''
                  }`}
                >
                  refresh
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Search Input + Mobile Wilayah Filter Row (Tampil di Mobile & Tablet < lg; di lg+ muncul jika sedang ada kata kunci aktif) */}
        <div className={`${searchInputValue ? 'flex' : 'flex lg:hidden'} items-center gap-2`}>
          <div className="relative flex-1 min-w-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Cari ustadz, kitab, atau masjid..."
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs sm:text-[13px] rounded-xl pl-9 pr-8 py-2 border border-outline-variant/30 focus:bg-surface-container-lowest focus:outline-none focus:border-[#126947] transition-colors"
            />
            {searchInputValue && (
              <button
                type="button"
                onClick={() => {
                  setSearchInputValue('');
                  setFilters((p) => ({ ...p, searchQuery: '' }));
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-outline/15 hover:bg-outline/25 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                title="Hapus pencarian"
              >
                <span className="material-symbols-outlined text-[13px]">close</span>
              </button>
            )}
          </div>

          {/* Tombol Filter Wilayah di Mobile (< lg) satu baris dengan Search */}
          <button
            type="button"
            onClick={() => setIsRegionModalOpen(true)}
            className={`lg:hidden relative h-[36px] px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold shrink-0 transition-all cursor-pointer ${
              hasActiveModalFilters
                ? 'bg-[#126947] text-white border-[#126947] shadow-2xs'
                : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/30 text-on-surface'
            }`}
            title="Filter Wilayah Kajian"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span className="max-w-[90px] truncate">
              {filters.region ? filters.region.name : 'Wilayah'}
            </span>
            {hasActiveModalFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
            )}
          </button>
        </div>

        {/* Active Region Chip */}
        {hasActiveModalFilters && filters.region && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e4eee8] dark:bg-emerald-950/60 border border-[#126947]/20 text-[#126947] dark:text-emerald-300 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setIsRegionModalOpen(true)}
                className="inline-flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                <span>Wilayah: {filters.region.name}</span>
              </button>
              <button
                type="button"
                onClick={() => setFilters((p) => ({ ...p, region: null }))}
                className="ml-0.5 hover:opacity-75 flex items-center cursor-pointer"
                title="Reset wilayah ke Seluruh Indonesia"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </span>
          </div>
        )}

        {/* Scrollable Filter Pills (Gaya Homepage) */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 select-none no-scrollbar items-center">
          <Pill
            active={filters.time === 'semua'}
            label="Semua Jadwal"
            onClick={() =>
              setFilters((p) => ({
                ...p,
                time: 'semua',
                audience: ['umum', 'ikhwan', 'akhwat'],
              }))
            }
          />
          <Pill
            active={filters.time === 'hari_ini' || filters.time === 'berlangsung'}
            label="Hari Ini"
            onClick={() =>
              setFilters((p) => ({
                ...p,
                time:
                  p.time === 'hari_ini' || p.time === 'berlangsung' ? 'semua' : 'hari_ini',
                audience: ['umum', 'ikhwan', 'akhwat'],
              }))
            }
          />
          <Pill
            active={filters.time === 'terdekat'}
            label="Dekat Saya"
            onClick={() => {
              if (!userLocation && onRequestLocation) onRequestLocation();
              setFilters((p) => ({
                ...p,
                time: p.time === 'terdekat' ? 'semua' : 'terdekat',
                audience: ['umum', 'ikhwan', 'akhwat'],
              }));
            }}
          />
          <Pill
            active={filters.time === 'online'}
            label="Online"
            onClick={() =>
              setFilters((p) => ({
                ...p,
                time: p.time === 'online' ? 'semua' : 'online',
                audience: ['umum', 'ikhwan', 'akhwat'],
              }))
            }
          />
          <Pill
            active={filters.time === 'tersimpan'}
            label={bookmarks.length > 0 ? `Tersimpan (${bookmarks.length})` : 'Tersimpan'}
            onClick={() =>
              setFilters((p) => ({
                ...p,
                time: p.time === 'tersimpan' ? 'semua' : 'tersimpan',
                audience: ['umum', 'ikhwan', 'akhwat'],
              }))
            }
          />
          <Pill
            active={filters.time === 'rutin'}
            label="Rutin"
            onClick={() =>
              setFilters((p) => ({
                ...p,
                time: p.time === 'rutin' ? 'semua' : 'rutin',
                audience: ['umum', 'ikhwan', 'akhwat'],
              }))
            }
          />
          <Pill
            active={
              filters.time === 'akhwat' ||
              (!filters.audience.includes('ikhwan') && filters.audience.includes('akhwat'))
            }
            label="Khusus Akhwat"
            onClick={() => {
              const isCurrentlyAkhwat =
                filters.time === 'akhwat' ||
                (!filters.audience.includes('ikhwan') && filters.audience.includes('akhwat'));
              setFilters((p) => ({
                ...p,
                time: isCurrentlyAkhwat ? 'semua' : 'akhwat',
                audience: isCurrentlyAkhwat ? ['umum', 'ikhwan', 'akhwat'] : ['akhwat'],
              }));
            }}
          />
          <Pill
            active={filters.time === 'selesai'}
            label="Arsip Selesai"
            onClick={() =>
              setFilters((p) => ({
                ...p,
                time: p.time === 'selesai' ? 'semua' : 'selesai',
                audience: ['umum', 'ikhwan', 'akhwat'],
              }))
            }
          />
        </div>
      </div>

      {/* 2. Scrollable List of Kajian Cards */}
      <div
        className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-3.5 space-y-2.5 pb-28 md:pb-6 overscroll-contain"
        ref={listRef}
      >
        {/* Banner Cloud Backup untuk Pengguna Anonim di Tab Tersimpan */}
        {filters.time === 'tersimpan' && !currentUser && bookmarks.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 text-on-surface flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              cloud_off
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-on-surface leading-tight">
                Jadwal Tersimpan di Memori Perangkat
              </p>
              <p className="text-[11px] text-on-surface-variant leading-relaxed mt-0.5">
                Masuk akun Google agar kajian tersimpan otomatis dicadangkan ke cloud.
              </p>
              <div className="mt-2">
                <Link
                  href="/login?next=/peta?tab=tersimpan"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-600 dark:bg-amber-500 text-white text-[11px] font-semibold hover:opacity-90 transition-opacity shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[14px]">login</span>
                  <span>Cadangkan ke Akun</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Banner Info Kajian Offline */}
        {(hasConnectionError || isOffline) &&
          sessions.length > 0 &&
          filters.time !== 'tersimpan' && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[17px] shrink-0 text-amber-600">
                  cloud_off
                </span>
                <span className="text-[11px] leading-tight truncate">
                  Mode Offline: <strong>{sessions.length} kajian</strong> dari memori perangkat
                </span>
              </div>
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isRefreshing ? '...' : 'Coba Lagi'}
                </button>
              )}
            </div>
          )}

        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (hasConnectionError || isOffline) && sessions.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-3 my-auto rounded-2xl bg-surface-container-lowest border border-outline-variant/25">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-2xs">
              <span className="material-symbols-outlined text-[32px]">wifi_off</span>
            </div>
            <div>
              <p className="font-bold text-sm text-on-surface">Tidak Ada Koneksi Internet</p>
              <p className="text-xs text-on-surface-variant max-w-[260px] mt-1 leading-relaxed">
                Gagal memuat jadwal kajian terbaru. Periksa koneksi internet Anda lalu coba lagi.
              </p>
            </div>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#126947] text-white text-xs font-semibold hover:bg-[#0e5237] transition-colors shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <span
                  className={`material-symbols-outlined text-[16px] ${
                    isRefreshing ? 'animate-spin' : ''
                  }`}
                >
                  refresh
                </span>
                <span>{isRefreshing ? 'Mencoba Terhubung...' : 'Coba Lagi'}</span>
              </button>
            )}
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-outline text-sm flex flex-col items-center justify-center gap-2 rounded-2xl bg-surface-container-lowest border border-outline-variant/25">
            {filters.time === 'tersimpan' ? (
              <>
                <span className="material-symbols-outlined text-[36px] text-amber-500/80">
                  bookmark_border
                </span>
                <p className="font-semibold text-on-surface">Belum Ada Kajian Tersimpan</p>
                <p className="text-xs text-on-surface-variant max-w-[240px]">
                  Tandai kajian favorit dengan ikon simpan untuk menyusun jadwal kajian pribadi
                  Anda.
                </p>
              </>
            ) : filters.time === 'selesai' ? (
              <>
                <span className="material-symbols-outlined text-[36px] text-outline/60">
                  history
                </span>
                <p className="font-semibold text-on-surface">Tidak Ada Arsip Kajian Selesai</p>
                <p className="text-xs text-on-surface-variant max-w-[240px]">
                  Belum ada riwayat kajian masa lalu yang sesuai dengan filter pencarian ini.
                </p>
              </>
            ) : filters.time === 'akhwat' ? (
              <>
                <span className="material-symbols-outlined text-[36px] text-outline/60">
                  female
                </span>
                <p className="font-semibold text-on-surface">Tidak Ada Kajian Khusus Akhwat</p>
                <p className="text-xs text-on-surface-variant max-w-[240px]">
                  Belum ada jadwal kajian khusus akhwat yang sesuai dengan filter pencarian ini.
                </p>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[36px] text-outline/60">
                  event_busy
                </span>
                <p className="font-semibold text-on-surface">Belum Ada Kajian yang Cocok</p>
                <p className="text-xs text-on-surface-variant max-w-[240px]">
                  Tidak ada jadwal kajian mendatang yang sesuai dengan filter atau pencarian saat ini.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {(evaluatedSessions || sessions).slice(0, visibleCount).map((item) => {
              const isEvaluated = Boolean(evaluatedSessions && 'session' in item);
              const session = isEvaluated
                ? (item as EvaluatedStudySession).session
                : (item as StudySession);
              const evaluated = isEvaluated ? (item as EvaluatedStudySession) : undefined;

              let distanceLabel: string | null = evaluated ? evaluated.distanceLabel : null;
              if (!evaluated && userLocation && session.venues?.lat && session.venues?.lng) {
                const dist = calculateDistance(
                  userLocation.lat,
                  userLocation.lng,
                  session.venues.lat,
                  session.venues.lng
                );
                distanceLabel =
                  dist < 1 ? `${(dist * 1000).toFixed(0)} m` : `${dist.toFixed(1)} km`;
              }

              const isSelected = selectedSession?.id === session.id;

              return (
                <KajianSidebarCard
                  key={session.id}
                  session={session}
                  evaluated={evaluated}
                  isSelected={isSelected}
                  isBookmarked={isBookmarked(session.id)}
                  distanceLabel={distanceLabel}
                  onSelect={onSelectSession}
                  onToggleBookmark={toggleBookmark}
                  currentUser={currentUser}
                />
              );
            })}

            {/* Sentinel & Skeleton Loader saat masih ada jadwal berikutnya */}
            {visibleCount < sessions.length && (
              <div ref={sentinelRef} className="space-y-2.5 pt-0.5">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Filter Wilayah Kajian */}
      <RegionPickerModal
        isOpen={isRegionModalOpen}
        onClose={() => setIsRegionModalOpen(false)}
        selectedRegion={filters.region}
        onSelectRegion={(r) => setFilters((p) => ({ ...p, region: r }))}
        sessions={allSessions || sessions}
        onResetAll={() =>
          setFilters((p) => ({
            ...p,
            region: null,
          }))
        }
      />
    </div>
  );
}

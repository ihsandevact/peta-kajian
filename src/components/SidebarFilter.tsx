import React, { useRef, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { FilterState } from '@/components/HomeClient';
import { type StudySession } from '@/lib/services/kajian';
import SkeletonCard from './SkeletonCard';
import { calculateDistance } from '@/utils/distance';
import RegionPickerModal, { KAJIAN_FACILITY_OPTIONS } from './RegionPickerModal';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { useBookmarks } from '@/utils/bookmarks';
import { triggerLoginNudge } from '@/components/LoginNudgePrompt';
import { useDebounce } from '@/lib/hooks/useDebounce';

interface SidebarFilterProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  sessions: StudySession[];
  allSessions?: StudySession[];
  selectedSession: StudySession | null;
  onSelectSession: (s: StudySession | null) => void;
  isLoading?: boolean;
  userLocation?: {lat: number, lng: number} | null;
  onRequestLocation?: () => void;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  currentUser?: any;
  hasConnectionError?: boolean;
  isOffline?: boolean;
}

interface KajianSidebarCardProps {
  session: StudySession;
  isSelected: boolean;
  isBookmarked: boolean;
  distanceLabel: string | null;
  onSelect: (session: StudySession) => void;
  onToggleBookmark: (sessionId: string, session: StudySession) => void;
  currentUser: any;
  isLast: boolean;
  lastElementRef?: (node: HTMLDivElement) => void;
}

const KajianSidebarCard = React.memo(
  function KajianSidebarCard({
    session,
    isSelected,
    isBookmarked,
    distanceLabel,
    onSelect,
    onToggleBookmark,
    currentUser,
    isLast,
    lastElementRef,
  }: KajianSidebarCardProps) {
    const info = React.useMemo(() => {
      return getEffectiveSessionInfo(session, new Date());
    }, [session]);

    const [imgError, setImgError] = React.useState(false);

    React.useEffect(() => {
      setImgError(false);
    }, [session.id, session.poster_url]);

    const isLive = info.isLive;
    const isPast = info.isPast && !session.is_recurring;
    const isToday = (info.isToday || info.isLive) && !isPast;
    const isRutin = session.is_recurring;
    const isAkhwatOnly = session.audience_type === 'akhwat';

    const hasPoster = Boolean(
      session.poster_url &&
      session.poster_url.trim() !== '' &&
      session.poster_url.toLowerCase() !== 'null' &&
      session.poster_url.toLowerCase() !== 'undefined' &&
      !imgError
    );

    return (
      <div
        data-id={session.id}
        ref={isLast ? lastElementRef : null}
        onClick={() => onSelect(session)}
        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 135px' }}
        className={`cursor-pointer p-3.5 sm:p-4 transition-all relative border-b border-surface-container-high/50 group ${
          isSelected
            ? 'bg-primary-container/10 shadow-[inset_3px_0_0_0_#15803d]'
            : isPast
            ? 'bg-surface-container-low/30 opacity-80 hover:opacity-100 hover:bg-surface-container-low'
            : 'hover:bg-surface-container-low'
        }`}
      >
        {/* Konten Utama: Kolom Teks Informasi di Kiri + Kolom Aksi & Thumbnail di Kanan (Opsi 1) */}
        <div className="flex items-start justify-between gap-3">
          {/* Kolom Kiri: Tanggal, Judul, Pemateri, Kitab, Lokasi */}
          <div className="flex-1 min-w-0">
            {/* Baris 1: Tanggal & Waktu */}
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span
                className={`text-[12px] font-bold truncate ${
                  isToday
                    ? 'text-red-600 dark:text-red-400'
                    : isAkhwatOnly
                    ? 'text-tertiary'
                    : 'text-primary'
                }`}
              >
                {info.dateLabel}
              </span>
              {session.is_test && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
                  <span className="material-symbols-outlined text-[12px]">science</span>
                  <span>TEST ADMIN</span>
                </span>
              )}
            </div>

            {/* Baris 2: Judul Kajian & Nama Pemateri */}
            <div className="mt-1">
              <h2 className="text-[13px] sm:text-sm font-semibold text-on-surface group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                {session.title}
              </h2>
              <p className="text-xs font-medium text-on-surface-variant mt-0.5 truncate">
                {session.speaker_name}
              </p>
            </div>

            {/* Baris 3: Judul Kitab (Jika Ada) */}
            {session.book_title && session.book_title.trim() !== '' && session.book_title.toLowerCase() !== 'null' && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-outline font-medium truncate" title={`Kitab: ${session.book_title}`}>
                <span className="material-symbols-outlined text-[14px] shrink-0 text-outline">menu_book</span>
                <span className="truncate">{session.book_title}</span>
              </div>
            )}

            {/* Baris 4: Lokasi Masjid / Online */}
            {session.venues ? (
              <div className="mt-1 flex items-center gap-1.5 text-outline text-xs">
                <span className="material-symbols-outlined text-[15px] shrink-0">location_on</span>
                <span className="truncate">{session.venues.name}</span>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-1.5 text-outline text-xs">
                <span className="material-symbols-outlined text-[15px] text-[#dc2626] shrink-0">videocam</span>
                <span className="truncate">Kajian Online / Live Streaming</span>
              </div>
            )}
          </div>

          {/* Kolom Kanan: Tombol Bookmark + Poster Thumbnail */}
          <div className="flex flex-col items-end gap-2 shrink-0">
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
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isBookmarked
                  ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/60 shadow-2xs'
                  : 'text-outline hover:text-on-surface hover:bg-surface-container-high'
              }`}
              title={isBookmarked ? 'Hapus dari Tersimpan' : 'Simpan Kajian (Bookmark)'}
            >
              <span
                className="material-symbols-outlined text-[15px]"
                style={{ fontVariationSettings: isBookmarked ? "'FILL' 1" : "'FILL' 0" }}
              >
                bookmark
              </span>
            </button>

            {/* Poster Thumbnail */}
            {hasPoster && (
              <div className="w-16 h-[84px] sm:w-[70px] sm:h-[90px] rounded-xl overflow-hidden bg-surface-container-low border border-surface-container-high/60 shrink-0 relative shadow-2xs group-hover:shadow-xs transition-all">
                <img
                  src={session.poster_url}
                  alt={`Poster ${session.title}`}
                  className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
                    isPast ? 'grayscale-[35%] brightness-90' : ''
                  }`}
                  loading="lazy"
                  onError={() => setImgError(true)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Baris 5 (Paling Bawah): Status Badges, Kategori Audiens & Jarak */}
        <div className="mt-2.5 pt-1.5 border-t border-surface-container-high/40 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isToday ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white uppercase tracking-wide shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                Hari Ini
              </span>
            ) : isRutin ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#e0f2fe] text-[#0369a1] dark:bg-sky-950/50 dark:text-sky-300 uppercase tracking-wide border border-[#bae6fd] dark:border-sky-800">
                <span className="material-symbols-outlined text-[12px]">event_repeat</span>
                Rutin
              </span>
            ) : isPast ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant uppercase tracking-wide border border-surface-container-high">
                <span className="material-symbols-outlined text-[12px] text-outline">history</span>
                Selesai
              </span>
            ) : (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#dcfce7] text-[#166534] dark:bg-emerald-950/50 dark:text-emerald-300 uppercase tracking-wide border border-[#bbf7d0] dark:border-emerald-800">
                Akan Datang
              </span>
            )}

            <span className="text-[10px] font-semibold text-on-surface-variant capitalize px-1.5 py-0.5 bg-surface-container-low rounded border border-surface-container-high/60">
              {session.audience_type}
            </span>
          </div>

          {distanceLabel && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant shrink-0">
              {distanceLabel}
            </span>
          )}
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.isSelected === next.isSelected &&
      prev.isBookmarked === next.isBookmarked &&
      prev.session === next.session &&
      prev.distanceLabel === next.distanceLabel &&
      prev.isLast === next.isLast &&
      prev.currentUser === next.currentUser
    );
  }
);

export default function SidebarFilter({
  filters,
  setFilters,
  sessions,
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
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [searchInputValue, setSearchInputValue] = useState(filters.searchQuery);

  const { bookmarks, isBookmarked, toggle: toggleBookmark } = useBookmarks();

  const debouncedSearchInput = useDebounce(searchInputValue, 280);

  // Sinkronkan state lokal jika filters.searchQuery berubah dari luar
  useEffect(() => {
    setSearchInputValue(filters.searchQuery);
  }, [filters.searchQuery]);

  // Perbarui filters.searchQuery ke state global setelah debounce 280ms
  useEffect(() => {
    if (debouncedSearchInput !== filters.searchQuery) {
      setFilters(p => ({ ...p, searchQuery: debouncedSearchInput }));
    }
  }, [debouncedSearchInput, filters.searchQuery, setFilters]);

  // Reset pagination saat pencarian atau filter berubah
  useEffect(() => {
    setVisibleCount(10);
  }, [filters, sessions.length]);

  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (isLoading) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleCount < sessions.length) {
        // Load next 10 items
        setVisibleCount(prev => Math.min(prev + 10, sessions.length));
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [isLoading, sessions.length, visibleCount]);
  
  // Auto-scroll ke elemen terpilih
  useEffect(() => {
    if (selectedSession && listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-id="${selectedSession.id}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedSession]);

  const Pill = ({ active, label, onClick }: { active: boolean, label: string, onClick: () => void }) => (
    <button 
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors shadow-sm
        ${active 
          ? 'bg-primary text-white dark:bg-emerald-600 dark:text-white font-semibold shadow-xs' 
          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
    >
      {label}
    </button>
  );

  const hasActiveModalFilters = Boolean(filters.region || filters.facilities.length > 0);

  return (
    <div className="h-full flex flex-col">
      {/* 1. Sticky Search & Filter Header */}
      <div className="flex p-4 pb-2 bg-surface-container-lowest/95 backdrop-blur-md flex-col gap-2.5 border-b border-surface-container-high shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="font-semibold text-base text-on-surface tracking-tight">Peta Kajian</h1>
            <span className="w-2 h-2 rounded-full bg-primary-container inline-block ml-1.5 align-middle"></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href="/faq"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:bg-primary/10 px-2.5 py-0.5 rounded-full transition-colors border border-primary/20"
              title="Pusat Bantuan & Tanya Jawab"
            >
              <span className="material-symbols-outlined text-[13px]">help</span>
              <span>FAQ</span>
            </Link>
          </div>
        </div>
        
        {/* Search Input + Unified Filter Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              search
            </span>
            <input 
              type="text" 
              placeholder="Cari ustadz, kitab, atau masjid..." 
              value={searchInputValue}
              onChange={e => setSearchInputValue(e.target.value)}
              className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs sm:text-sm rounded-xl pl-9 pr-8 py-2 border border-surface-container-high/80 focus:bg-surface-container-lowest focus:outline-none focus:border-primary transition-all"
            />
            {searchInputValue && (
              <button
                type="button"
                onClick={() => {
                  setSearchInputValue('');
                  setFilters(p => ({ ...p, searchQuery: '' }));
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-outline/20 hover:bg-outline/30 flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
                title="Hapus pencarian"
              >
                <span className="material-symbols-outlined text-[13px]">close</span>
              </button>
            )}
          </div>

          {/* Tombol Filter Wilayah & Fasilitas (Modal di Desktop / Bottom Sheet di Mobile) */}
          <button
            type="button"
            onClick={() => setIsRegionModalOpen(true)}
            className={`relative h-9 sm:h-[38px] px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold shrink-0 transition-all cursor-pointer ${
              hasActiveModalFilters
                ? 'bg-primary text-white border-primary shadow-xs'
                : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high/80 text-on-surface'
            }`}
            title="Filter Wilayah & Fasilitas Kajian"
            aria-label="Filter Wilayah & Fasilitas Kajian"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span className="hidden xs:inline max-w-[96px] truncate">
              {filters.region ? filters.region.name : 'Filter'}
            </span>
            {hasActiveModalFilters && (
              <span className="w-2 h-2 rounded-full bg-amber-300 shrink-0" />
            )}
          </button>
        </div>

        {/* Active Region / Facility Chips (Hanya muncul saat ada filter aktif agar hemat ruang) */}
        {hasActiveModalFilters && (
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.region && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setIsRegionModalOpen(true)}
                  className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                  title="Ubah wilayah kajian"
                >
                  <span className="material-symbols-outlined text-[14px]">location_on</span>
                  <span>{filters.region.name}</span>
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
            )}

            {filters.facilities.map((facId) => {
              const facMeta = KAJIAN_FACILITY_OPTIONS.find((f) => f.id === facId);
              if (!facMeta) return null;
              return (
                <span
                  key={facId}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[11px] font-bold"
                >
                  <span className="material-symbols-outlined text-[14px]">{facMeta.icon}</span>
                  <span>{facMeta.label}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setFilters((p) => ({
                        ...p,
                        facilities: p.facilities.filter((f) => f !== facId),
                      }))
                    }
                    className="ml-0.5 hover:opacity-75 flex items-center cursor-pointer"
                    title={`Hapus filter ${facMeta.label}`}
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Scrollable Filters Area */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 pt-0.5 select-none no-scrollbar items-center">
          <Pill
            active={filters.time === 'semua'}
            label="Mendatang"
            onClick={() => setFilters(p => ({ ...p, time: 'semua', audience: ['umum', 'ikhwan', 'akhwat'] }))}
          />
          <Pill
            active={filters.time === 'tersimpan'}
            label={bookmarks.length > 0 ? `📌 Tersimpan (${bookmarks.length})` : '📌 Tersimpan'}
            onClick={() => setFilters(p => ({ ...p, time: p.time === 'tersimpan' ? 'semua' : 'tersimpan', audience: ['umum', 'ikhwan', 'akhwat'] }))}
          />
          <Pill
            active={filters.time === 'hari_ini' || filters.time === 'berlangsung'}
            label="Hari Ini"
            onClick={() => setFilters(p => ({ ...p, time: (p.time === 'hari_ini' || p.time === 'berlangsung') ? 'semua' : 'hari_ini', audience: ['umum', 'ikhwan', 'akhwat'] }))}
          />
          <Pill
            active={filters.time === 'terdekat'}
            label="Terdekat"
            onClick={() => {
              if (!userLocation && onRequestLocation) onRequestLocation();
              setFilters(p => ({ ...p, time: p.time === 'terdekat' ? 'semua' : 'terdekat', audience: ['umum', 'ikhwan', 'akhwat'] }));
            }}
          />
          <Pill
            active={filters.time === 'rutin'}
            label="Rutin"
            onClick={() => setFilters(p => ({ ...p, time: p.time === 'rutin' ? 'semua' : 'rutin', audience: ['umum', 'ikhwan', 'akhwat'] }))}
          />
          <Pill
            active={filters.time === 'online'}
            label="Online (Hybrid)"
            onClick={() => setFilters(p => ({ ...p, time: p.time === 'online' ? 'semua' : 'online', audience: ['umum', 'ikhwan', 'akhwat'] }))}
          />
          <Pill
            active={filters.time === 'akhwat' || (!filters.audience.includes('ikhwan') && filters.audience.includes('akhwat'))}
            label="Khusus Akhwat"
            onClick={() => {
              const isCurrentlyAkhwat = filters.time === 'akhwat' || (!filters.audience.includes('ikhwan') && filters.audience.includes('akhwat'));
              setFilters(p => ({
                ...p,
                time: isCurrentlyAkhwat ? 'semua' : 'akhwat',
                audience: isCurrentlyAkhwat ? ['umum', 'ikhwan', 'akhwat'] : ['akhwat'],
              }));
            }}
          />
          <Pill
            active={filters.time === 'selesai'}
            label="Arsip Selesai"
            onClick={() => setFilters(p => ({ ...p, time: p.time === 'selesai' ? 'semua' : 'selesai', audience: ['umum', 'ikhwan', 'akhwat'] }))}
          />
        </div>
      </div>

      {/* 2. Result Count Subtext Bar */}
      <div className="flex px-4 py-1.5 bg-surface-container-low/70 items-center justify-between text-outline text-[11px] font-medium shrink-0">
        <span className="truncate pr-2" suppressHydrationWarning>
          Menampilkan {sessions.length} kajian{filters.time === 'selesai' ? ' (Arsip Selesai)' : filters.time === 'akhwat' ? ' (Khusus Akhwat)' : ''}{filters.region ? ` di ${filters.region.name}` : ''}
        </span>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1 hover:text-on-surface text-outline transition-colors px-1.5 py-0.5 rounded hover:bg-surface-container-high/60 cursor-pointer shrink-0 disabled:opacity-50"
            title="Perbarui data kajian terbaru"
          >
            <span className={`material-symbols-outlined text-[13px] ${isRefreshing ? 'animate-spin text-primary' : ''}`}>
              refresh
            </span>
            <span className="text-[10px] hidden xs:inline">{isRefreshing ? 'Memperbarui...' : 'Segarkan'}</span>
          </button>
        )}
      </div>

      {/* 3. Scrollable List of Kajian Items */}
      <div className="flex-1 overflow-y-auto pb-28 md:pb-6 overscroll-contain" ref={listRef}>
        {/* Banner Cloud Backup untuk Pengguna Anonim di Tab Tersimpan */}
        {filters.time === 'tersimpan' && !currentUser && bookmarks.length > 0 && (
          <div className="mx-3 mt-2.5 mb-1.5 p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 text-on-surface flex items-start gap-2.5 animate-in fade-in duration-200">
            <span className="material-symbols-outlined text-[20px] text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              cloud_off
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-on-surface leading-tight">
                Jadwal Tersimpan di Memori Perangkat
              </p>
              <p className="text-[11px] text-on-surface-variant leading-relaxed mt-0.5">
                Masuk akun Google agar kajian tersimpan otomatis dicadangkan ke cloud & tidak hilang saat ganti HP.
              </p>
              <div className="mt-2">
                <Link
                  href="/login?next=/peta?tab=tersimpan"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-600 dark:bg-amber-500 text-white text-[11px] font-semibold hover:opacity-90 transition-all shadow-2xs active:scale-95"
                >
                  <span className="material-symbols-outlined text-[14px]">login</span>
                  <span>Cadangkan ke Akun</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Banner Info Kajian Offline jika menggunakan data cache lokal */}
        {(hasConnectionError || isOffline) && sessions.length > 0 && filters.time !== 'tersimpan' && (
          <div className="mx-3.5 my-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[17px] shrink-0 text-amber-600">cloud_off</span>
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
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (hasConnectionError || isOffline) && sessions.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-3 my-auto">
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
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[16px] ${isRefreshing ? 'animate-spin' : ''}`}>
                  refresh
                </span>
                <span>{isRefreshing ? 'Mencoba Terhubung...' : 'Coba Lagi'}</span>
              </button>
            )}
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-outline text-sm flex flex-col items-center justify-center gap-2">
            {filters.time === 'tersimpan' ? (
              <>
                <span className="material-symbols-outlined text-[36px] text-amber-500/80">bookmark_border</span>
                <p className="font-semibold text-on-surface">Belum Ada Kajian Tersimpan</p>
                <p className="text-xs text-on-surface-variant max-w-[240px]">
                  Tandai kajian favorit dengan ikon simpan untuk menyusun jadwal kajian pribadi Anda.
                </p>
              </>
            ) : filters.time === 'selesai' ? (
              <>
                <span className="material-symbols-outlined text-[36px] text-outline/60">history</span>
                <p className="font-semibold text-on-surface">Tidak Ada Arsip Kajian Selesai</p>
                <p className="text-xs text-on-surface-variant max-w-[240px]">
                  Belum ada riwayat kajian masa lalu yang sesuai dengan filter pencarian ini.
                </p>
              </>
            ) : filters.time === 'akhwat' ? (
              <>
                <span className="material-symbols-outlined text-[36px] text-outline/60">female</span>
                <p className="font-semibold text-on-surface">Tidak Ada Kajian Khusus Akhwat</p>
                <p className="text-xs text-on-surface-variant max-w-[240px]">
                  Belum ada jadwal kajian khusus akhwat yang sesuai dengan filter pencarian ini.
                </p>
              </>
            ) : (
              'Tidak ada kajian mendatang yang sesuai pencarian.'
            )}
          </div>
        ) : (
          sessions.slice(0, visibleCount).map((session, index) => {
            // Haversine Distance Calculation
            let distanceLabel: string | null = null;
            if (userLocation && session.venues?.lat && session.venues?.lng) {
              const dist = calculateDistance(userLocation.lat, userLocation.lng, session.venues.lat, session.venues.lng);
              distanceLabel = dist < 1 ? `${(dist * 1000).toFixed(0)} m` : `${dist.toFixed(1)} km`;
            }

            const isSelected = selectedSession?.id === session.id;
            const isLast = index === visibleCount - 1;

            return (
              <KajianSidebarCard
                key={session.id}
                session={session}
                isSelected={isSelected}
                isBookmarked={isBookmarked(session.id)}
                distanceLabel={distanceLabel}
                onSelect={onSelectSession}
                onToggleBookmark={toggleBookmark}
                currentUser={currentUser}
                isLast={isLast}
                lastElementRef={lastElementRef}
              />
            );
          })
        )}
        
        {!isLoading && visibleCount < sessions.length && (
          <div className="p-4 flex justify-center">
            <span className="material-symbols-outlined animate-spin text-outline">progress_activity</span>
          </div>
        )}
      </div>

      {/* Modal Filter & Wilayah Kajian */}
      <RegionPickerModal
        isOpen={isRegionModalOpen}
        onClose={() => setIsRegionModalOpen(false)}
        selectedRegion={filters.region}
        onSelectRegion={(r) => setFilters((p) => ({ ...p, region: r }))}
        sessions={allSessions || sessions}
        selectedFacilities={filters.facilities}
        onToggleFacility={(facId) =>
          setFilters((p) => ({
            ...p,
            facilities: p.facilities.includes(facId)
              ? p.facilities.filter((f) => f !== facId)
              : [...p.facilities, facId],
          }))
        }
        onResetAll={() =>
          setFilters((p) => ({
            ...p,
            region: null,
            facilities: [],
          }))
        }
      />
    </div>
  );
}

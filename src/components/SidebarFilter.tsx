import React, { useRef, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { FilterState } from '@/app/page';
import { type StudySession, hasPhysicalLocation } from '@/lib/services/kajian';
import SkeletonCard from './SkeletonCard';
import { calculateDistance } from '@/utils/distance';
import RegionPickerModal from './RegionPickerModal';
import type { SelectedRegion } from '@/utils/regions';
import { getEffectiveSessionInfo } from '@/utils/recurring';
import { useBookmarks } from '@/utils/bookmarks';
import ShareModal, { shareSessionNative } from '@/components/ShareModal';
import { useLivePlayer } from '@/context/LivePlayerContext';
import { extractYouTubeVideoId } from '@/utils/youtube';
import { triggerLoginNudge } from '@/components/LoginNudgePrompt';
import { FEATURE_FLAGS } from '@/config/features';

interface SidebarFilterProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  sessions: StudySession[];
  allSessions?: StudySession[];
  selectedSession: StudySession | null;
  onSelectSession: (s: StudySession | null) => void;
  isLoading?: boolean;
  userLocation?: {lat: number, lng: number} | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  currentUser?: any;
}

export default function SidebarFilter({
  filters,
  setFilters,
  sessions,
  allSessions,
  selectedSession,
  onSelectSession,
  isLoading = false,
  userLocation = null,
  isRefreshing = false,
  onRefresh,
  currentUser,
}: SidebarFilterProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [sharingSession, setSharingSession] = useState<StudySession | null>(null);

  const { bookmarks, isBookmarked, toggle: toggleBookmark } = useBookmarks();
  const { playStream, openStudyMode } = useLivePlayer();

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
          ? 'bg-on-surface text-on-primary' 
          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
    >
      {label}
    </button>
  );

  const toggleAudience = (val: string) => {
    setFilters(p => {
      let newAudience = [...p.audience];
      if (val === 'semua') {
        newAudience = ['umum', 'ikhwan', 'akhwat'];
      } else {
        if (newAudience.includes(val)) {
          newAudience = newAudience.filter(a => a !== val);
        } else {
          newAudience.push(val);
        }
      }
      return { ...p, audience: newAudience };
    });
  };

  const getIslamicTimeLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const h = date.getHours();
    if (h >= 4 && h < 6) return "Ba'da Subuh";
    if (h >= 8 && h < 11) return "Dhuha";
    if (h >= 11 && h < 14) return "Ba'da Dzuhur";
    if (h >= 15 && h < 17) return "Ba'da Ashar";
    if (h >= 17 && h < 19) return "Ba'da Maghrib";
    if (h >= 19) return "Ba'da Isya";
    return "";
  };

  return (
    <div className="h-full flex flex-col">
      {/* 1. Sticky Search & Filter Header */}
      <div className="flex p-4 pb-2 bg-surface-container-lowest/95 backdrop-blur-md flex-col gap-3 border-b border-surface-container-high shrink-0">
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
            <span className="text-[10px] uppercase tracking-wider text-outline px-2 py-0.5 rounded bg-surface-container-low">
              Indonesia
            </span>
          </div>
        </div>
        
        {/* Search Input */}
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">search</span>
          <input 
            type="text" 
            placeholder="Cari ustadz, kitab, atau masjid..." 
            value={filters.searchQuery}
            onChange={e => setFilters(p => ({ ...p, searchQuery: e.target.value }))}
            className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-sm rounded-lg pl-9 pr-3 py-2 focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-primary-container transition-all"
          />
        </div>

        {/* Region Selector Bar */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsRegionModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border shrink-0 ${
              filters.region
                ? 'bg-primary text-white border-primary shadow-xs'
                : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {filters.region ? 'location_on' : 'explore'}
            </span>
            <span className="max-w-[130px] sm:max-w-[160px] truncate">
              {filters.region ? filters.region.name : 'Pilih Wilayah / Kota'}
            </span>
            <span className="material-symbols-outlined text-[16px] opacity-75">
              arrow_drop_down
            </span>
          </button>

          {filters.region ? (
            <button
              type="button"
              onClick={() => setFilters((p) => ({ ...p, region: null }))}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5 shrink-0"
              title="Reset ke Seluruh Indonesia"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              Reset Wilayah
            </button>
          ) : (
            <span className="text-[11px] text-outline truncate">
              Seluruh Indonesia
            </span>
          )}
        </div>

        {/* Scrollable Filters Area */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 pt-0.5 select-none no-scrollbar items-center">
          <Pill active={filters.time === 'semua'} label="Mendatang" onClick={() => setFilters(p => ({ ...p, time: 'semua' }))} />
          <Pill
            active={filters.time === 'tersimpan'}
            label={bookmarks.length > 0 ? `📌 Tersimpan (${bookmarks.length})` : '📌 Tersimpan'}
            onClick={() => setFilters(p => ({ ...p, time: 'tersimpan' }))}
          />
          <Pill active={filters.time === 'berlangsung'} label="🔴 Berlangsung" onClick={() => setFilters(p => ({ ...p, time: 'berlangsung' }))} />
          <Pill active={filters.time === 'terdekat'} label="Terdekat" onClick={() => setFilters(p => ({ ...p, time: 'terdekat' }))} />
          <Pill active={filters.time === 'rutin'} label="Rutin" onClick={() => setFilters(p => ({ ...p, time: 'rutin' }))} />
          <Pill active={filters.time === 'online'} label="Online (Hybrid)" onClick={() => setFilters(p => ({ ...p, time: 'online' }))} />
          <Pill active={!filters.audience.includes('ikhwan')} label="Khusus Akhwat" onClick={() => setFilters(p => ({ ...p, audience: p.audience.includes('ikhwan') ? ['akhwat'] : ['umum', 'ikhwan', 'akhwat'] }))} />
          <Pill active={filters.time === 'selesai'} label="Arsip Selesai" onClick={() => setFilters(p => ({ ...p, time: 'selesai' }))} />
        </div>
      </div>

      {/* 2. Result Count Subtext Bar */}
      <div className="flex px-4 py-1.5 bg-surface-container-low/70 items-center justify-between text-outline text-[11px] font-medium shrink-0">
        <span className="truncate pr-2">
          Menampilkan {sessions.length} kajian{filters.time === 'selesai' ? ' (Arsip Selesai)' : ''}{filters.region ? ` di ${filters.region.name}` : ''}
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
      <div className="flex-1 overflow-y-auto" ref={listRef}>
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
                Masuk akun Google (1-Klik) agar kajian tersimpan otomatis dicadangkan ke cloud & tidak hilang saat ganti HP.
              </p>
              <div className="mt-2">
                <Link
                  href="/login?next=/?tab=tersimpan"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-600 dark:bg-amber-500 text-white text-[11px] font-semibold hover:opacity-90 transition-all shadow-2xs active:scale-95"
                >
                  <span className="material-symbols-outlined text-[14px]">login</span>
                  <span>Cadangkan ke Akun</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
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
            ) : (
              'Tidak ada kajian mendatang yang sesuai pencarian.'
            )}
          </div>
        ) : (
          sessions.slice(0, visibleCount).map((session, index) => {
            const now = new Date();
            const info = getEffectiveSessionInfo(session, now);
            const isLive = info.isLive;
            const isPast = info.isPast && !session.is_recurring;
            const isRutin = session.is_recurring;
            
            const isAkhwatOnly = session.audience_type === 'akhwat';
            
            // Haversine Distance Calculation
            let distanceLabel: string | null = null;
            if (userLocation && session.venues?.lat && session.venues?.lng) {
              const dist = calculateDistance(userLocation.lat, userLocation.lng, session.venues.lat, session.venues.lng);
              distanceLabel = dist < 1 ? `${(dist * 1000).toFixed(0)} m` : `${dist.toFixed(1)} km`;
            }

            const isSelected = selectedSession?.id === session.id;
            const isLast = index === visibleCount - 1;

            return (
              <div 
                key={session.id} 
                data-id={session.id}
                ref={isLast ? lastElementRef : null}
                onClick={() => onSelectSession(session)}
                className={`cursor-pointer p-4 transition-colors relative border-b border-surface-container-high/50 group
                  ${isSelected ? 'bg-primary-container/10 shadow-[inset_3px_0_0_0_#15803d]' : isPast ? 'bg-surface-container-low/30 opacity-80 hover:opacity-100 hover:bg-surface-container-low' : 'hover:bg-surface-container-low'}
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[12px] font-bold ${isAkhwatOnly ? 'text-tertiary' : 'text-primary'}`}>
                      {info.dateLabel}
                    </span>
                    
                    {isLive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white uppercase tracking-wide shadow-xs animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                        Sedang Berlangsung
                      </span>
                    ) : isRutin ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#e0f2fe] text-[#0369a1] uppercase tracking-wide border border-[#bae6fd]">
                        <span className="material-symbols-outlined text-[12px]">event_repeat</span>
                        Rutin
                      </span>
                    ) : isPast ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant uppercase tracking-wide border border-surface-container-high">
                        <span className="material-symbols-outlined text-[12px] text-outline">history</span>
                        Selesai
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#dcfce7] text-[#166534] uppercase tracking-wide border border-[#bbf7d0]">Akan Datang</span>
                    )}

                    <span className="text-[11px] text-on-surface-variant capitalize px-1 bg-surface-container-low rounded">{session.audience_type}</span>

                    {session.is_online && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border ${
                        isPast
                          ? 'bg-surface-container text-on-surface-variant border-surface-container-high'
                          : 'bg-[#fee2e2] text-[#b91c1c] border-[#fecaca]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isPast ? 'bg-outline' : 'bg-[#dc2626]'}`}></span>
                        {isPast ? 'Siaran Selesai' : (session.venues ? 'Hybrid' : 'Online')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    {distanceLabel && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">{distanceLabel}</span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const willBookmark = !isBookmarked(session.id);
                        toggleBookmark(session.id, session);
                        if (willBookmark && !currentUser) {
                          triggerLoginNudge({ type: 'bookmark', title: session.title });
                        }
                      }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        isBookmarked(session.id)
                          ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/60 shadow-2xs'
                          : 'text-outline hover:text-on-surface hover:bg-surface-container-high'
                      }`}
                      title={isBookmarked(session.id) ? 'Hapus dari Tersimpan' : 'Simpan Kajian (Bookmark)'}
                    >
                      <span
                        className="material-symbols-outlined text-[15px]"
                        style={{ fontVariationSettings: isBookmarked(session.id) ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        bookmark
                      </span>
                    </button>
                  </div>
                </div>
                <div className="mt-1">
                  <h2 className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">{session.title}</h2>
                  <p className="text-[13px] text-on-surface-variant mt-0.5">{session.speaker_name}</p>
                </div>
                {session.venues ? (
                  <div className="mt-1 flex items-center gap-1 text-outline text-[13px]">
                    <span className="material-symbols-outlined text-[15px]">location_on</span>
                    <span className="truncate">{session.venues.name}</span>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-1 text-outline text-[13px]">
                    <span className="material-symbols-outlined text-[15px] text-[#dc2626]">videocam</span>
                    <span className="truncate">Kajian Online / Live Streaming</span>
                  </div>
                )}
                <div className="mt-2 pt-1.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {hasPhysicalLocation(session) && (
                      <a
                        href={`https://maps.google.com/?q=${session.venues?.lat},${session.venues?.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className={`inline-flex items-center gap-1 text-[11px] font-medium transition-colors ${
                          isPast
                            ? 'text-primary font-semibold hover:underline bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20'
                            : 'text-on-surface-variant hover:text-primary'
                        }`}
                      >
                        <span>Rute Maps</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </a>
                    )}
                    {session.stream_url && !isPast && (() => {
                      const ytId = extractYouTubeVideoId(session.stream_url);
                      if (ytId) {
                        return (
                          <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                openStudyMode({
                                  videoId: ytId,
                                  title: session.title,
                                  speakerName: session.speaker_name,
                                  channelName: session.venues?.name || session.speaker_name,
                                  sessionId: session.id,
                                });
                              }}
                              className={`${
                                FEATURE_FLAGS.ENABLE_MOBILE_STUDY_NOTES ? 'inline-flex' : 'hidden md:inline-flex'
                              } items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg transition-all shadow-2xs hover:scale-105 active:scale-95 cursor-pointer`}
                              title="Buka Mode Belajar & Catat Faidah"
                            >
                              <span className="material-symbols-outlined text-[15px] text-emerald-700 dark:text-emerald-400">edit_note</span>
                              <span>Belajar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                playStream({
                                  videoId: ytId,
                                  title: session.title,
                                  speakerName: session.speaker_name,
                                  channelName: session.venues?.name || session.speaker_name,
                                });
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-lg transition-all shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
                              title="Tonton Live di Pemutar Mengambang"
                            >
                              <span className="material-symbols-outlined text-[15px] text-red-600">play_circle</span>
                              <span>Live</span>
                            </button>
                          </div>
                        );
                      }
                      return (
                        <a 
                          href={session.stream_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          onClick={e => e.stopPropagation()} 
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition-all shadow-2xs hover:scale-105 active:scale-95"
                          title="Buka Link Live Streaming di Tab Baru"
                        >
                          <span className="material-symbols-outlined text-[15px] text-red-600">play_circle</span>
                          <span>Tonton Live</span>
                          <span className="material-symbols-outlined text-[12px] opacity-60">open_in_new</span>
                        </a>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        shareSessionNative(session, () => setSharingSession(session));
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                      title="Bagikan Info Kajian"
                    >
                      <span className="material-symbols-outlined text-[13px]">share</span>
                      <span>Bagikan</span>
                    </button>
                  </div>
                  {session.book_title && session.book_title !== 'null' && (
                    <span className="text-[11px] text-outline truncate max-w-[120px]" title={session.book_title}>
                      {session.book_title}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        
        {!isLoading && visibleCount < sessions.length && (
          <div className="p-4 flex justify-center">
            <span className="material-symbols-outlined animate-spin text-outline">progress_activity</span>
          </div>
        )}
      </div>

      {/* Modal Pemilih Wilayah */}
      <RegionPickerModal
        isOpen={isRegionModalOpen}
        onClose={() => setIsRegionModalOpen(false)}
        selectedRegion={filters.region}
        onSelectRegion={(r) => setFilters((p) => ({ ...p, region: r }))}
        sessions={allSessions || sessions}
      />

      {/* Modal Bagikan Kajian */}
      {sharingSession && (
        <ShareModal
          isOpen={!!sharingSession}
          onClose={() => setSharingSession(null)}
          session={sharingSession}
        />
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import {
  type YoutubeChannel,
  type UpcomingStreamItem,
  type EndedStreamItem,
  formatUpcomingTime,
  formatEndedTime,
} from '@/lib/services/youtubeTracker';
import MobileNavDrawer from '@/components/MobileNavDrawer';
import { checkIsAdmin } from '@/lib/services/admin';
import { useLivePlayer } from '@/context/LivePlayerContext';
import { FEATURE_FLAGS } from '@/config/features';
import ThemeToggle from '@/components/ThemeToggle';
import { useYoutubeChannelsQuery } from '@/lib/hooks/useYoutubeChannelsQuery';
import EndedStreamSkeleton from '@/components/live/EndedStreamSkeleton';
import StudyLoginModal from '@/components/StudyLoginModal';
import { type PendingStudySession } from '@/utils/studyNotes';
import { useDebounce } from '@/lib/hooks/useDebounce';

export default function LiveStreamingPage() {
  const { playStream, openStudyMode } = useLivePlayer();
  const {
    channels,
    isLoading: loading,
    isError: hasError,
    isFetching,
    refetch,
  } = useYoutubeChannelsQuery();

  const [activeTab, setActiveTab] = useState<'live' | 'upcoming' | 'ended'>('live');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedEndedChannelId, setSelectedEndedChannelId] = useState<string>('all');
  const [selectedVideo, setSelectedVideo] = useState<{
    videoId: string;
    title: string;
    channelName: string;
    speakerName?: string;
  } | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingStudyLogin, setPendingStudyLogin] = useState<PendingStudySession | null>(null);

  // Handler Mode Belajar dengan Login Guard khusus kartu video di halaman live
  const handleOpenStudyNotes = (sessionData: {
    videoId: string;
    title: string;
    channelName?: string;
    speakerName?: string;
    sessionId?: string;
  }) => {
    if (!currentUser) {
      // Pengguna belum login: Tampilkan modal login khusus Mode Belajar TANPA membuka mini player
      setPendingStudyLogin({
        videoId: sessionData.videoId,
        title: sessionData.title,
        channelName: sessionData.channelName,
        speakerName: sessionData.speakerName,
        sessionId: sessionData.sessionId,
      });
      return;
    }
    openStudyMode(sessionData);
  };

  // Infinite Scroll state untuk tab Rekaman Selesai (Ended Streams)
  const [visibleEndedCount, setVisibleEndedCount] = useState<number>(12);
  const [isLoadingMoreEnded, setIsLoadingMoreEnded] = useState<boolean>(false);
  const loadMoreEndedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Bersihkan flag auth redirect saat berada di halaman live
    try {
      sessionStorage.removeItem('peta_kajian_auth_in_progress');
      sessionStorage.removeItem('peta_kajian_auth_next');
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      document.cookie = `peta_kajian_auth_next=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT${isHttps ? '; Secure' : ''}`;
    } catch {}

    // Inisialisasi & sinkronisasi realtime status autentikasi user
    const supabase = createClient();

    async function handleUserAuth(u: any) {
      setCurrentUser(u);
      if (u) {
        try {
          const admin = await checkIsAdmin(u);
          setIsAdmin(admin);
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    }

    // Fallback: Jika pengguna diarahkan langsung ke /live dengan membawa ?code=
    if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
      const currentCode = new URLSearchParams(window.location.search).get('code');
      if (currentCode) {
        supabase.auth.exchangeCodeForSession(currentCode).then(({ data, error }) => {
          if (!error && data?.user) {
            handleUserAuth(data.user);
          }
          try {
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('code');
            window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search);
          } catch {}
        });
      }
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        handleUserAuth(data.user);
      } else {
        supabase.auth.getSession().then(({ data: sess }) => {
          if (sess?.session?.user) {
            handleUserAuth(sess.session.user);
          } else {
            handleUserAuth(null);
          }
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUserAuth(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Daftar channel yang sedang live saat ini (didukung proteksi deduplikasi)
  const liveChannels = useMemo(() => {
    const map = new Map<string, YoutubeChannel>();
    channels.forEach((c) => {
      if (c.is_currently_live && c.current_video_id) {
        // Kunci deduplikasi utama: videoId unik atau handle channel
        const normKey = (c.current_video_id || c.channel_handle).toLowerCase().trim();
        if (!map.has(normKey)) {
          map.set(normKey, c);
        }
      }
    });
    return Array.from(map.values());
  }, [channels]);

  // Daftar siaran mendatang (upcoming/premiere) yang dijadwalkan dari seluruh channel
  const upcomingStreams = useMemo(() => {
    const items: Array<UpcomingStreamItem & { channel: YoutubeChannel; channelName: string }> = [];
    const seenVideoIds = new Set<string>();

    channels.forEach((channel) => {
      if (Array.isArray(channel.upcoming_streams)) {
        channel.upcoming_streams.forEach((item) => {
          if (item?.videoId && !seenVideoIds.has(item.videoId)) {
            // Pastikan video tidak sedang berstatus live aktif di channel mana pun
            const isAlreadyLive = channels.some(
              (c) => c.is_currently_live && c.current_video_id === item.videoId
            );
            if (!isAlreadyLive) {
              seenVideoIds.add(item.videoId);
              items.push({
                ...item,
                channelName: item.channelName || channel.channel_name,
                channel,
              });
            }
          }
        });
      }
    });

    // Urutkan berdasarkan jadwal tayang paling dekat (ascending)
    items.sort((a, b) => {
      const timeA = a.scheduledStartTime ? new Date(a.scheduledStartTime).getTime() : Infinity;
      const timeB = b.scheduledStartTime ? new Date(b.scheduledStartTime).getTime() : Infinity;
      return timeA - timeB;
    });

    return items;
  }, [channels]);

  // Filter pencarian khusus untuk siaran live yang sedang tayang (debounced 300ms)
  const filteredLiveChannels = useMemo(() => {
    return liveChannels.filter((c) => {
      const q = debouncedSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        c.channel_name.toLowerCase().includes(q) ||
        c.channel_handle.toLowerCase().includes(q) ||
        (c.default_speaker_name && c.default_speaker_name.toLowerCase().includes(q)) ||
        (c.current_video_title && c.current_video_title.toLowerCase().includes(q))
      );
    });
  }, [liveChannels, debouncedSearchQuery]);

  // Filter pencarian untuk siaran mendatang (debounced 300ms)
  const filteredUpcomingStreams = useMemo(() => {
    return upcomingStreams.filter((item) => {
      const q = debouncedSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.channelName.toLowerCase().includes(q) ||
        (item.speakerName && item.speakerName.toLowerCase().includes(q)) ||
        item.channel.channel_handle.toLowerCase().includes(q)
      );
    });
  }, [upcomingStreams, debouncedSearchQuery]);

  // Daftar rekaman siaran live yang telah berakhir dari seluruh channel
  const endedStreams = useMemo(() => {
    const items: Array<EndedStreamItem & { channel: YoutubeChannel; channelName: string }> = [];
    const seenVideoIds = new Set<string>();

    channels.forEach((channel) => {
      if (Array.isArray(channel.ended_streams)) {
        channel.ended_streams.forEach((item) => {
          if (item?.videoId && !seenVideoIds.has(item.videoId)) {
            // Pastikan video tidak sedang berstatus live aktif di channel mana pun
            const isAlreadyLive = channels.some(
              (c) => c.is_currently_live && c.current_video_id === item.videoId
            );
            if (!isAlreadyLive) {
              seenVideoIds.add(item.videoId);
              items.push({
                ...item,
                channelName: item.channelName || channel.channel_name,
                channel,
              });
            }
          }
        });
      }
    });

    // Urutkan berdasarkan waktu siaran selesai paling baru (descending)
    items.sort((a, b) => {
      const timeA = a.endedAt ? new Date(a.endedAt).getTime() : 0;
      const timeB = b.endedAt ? new Date(b.endedAt).getTime() : 0;
      return timeB - timeA;
    });

    return items;
  }, [channels]);

  // Filter pencarian dan channel untuk rekaman siaran yang telah berakhir (debounced 300ms)
  const filteredEndedStreams = useMemo(() => {
    return endedStreams.filter((item) => {
      if (selectedEndedChannelId !== 'all' && item.channel.id !== selectedEndedChannelId) {
        return false;
      }
      const q = debouncedSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.channelName.toLowerCase().includes(q) ||
        (item.speakerName && item.speakerName.toLowerCase().includes(q)) ||
        item.channel.channel_handle.toLowerCase().includes(q)
      );
    });
  }, [endedStreams, debouncedSearchQuery, selectedEndedChannelId]);

  // Daftar channel yang memiliki setidaknya 1 rekaman live selesai
  const endedChannelsList = useMemo(() => {
    const map = new Map<string, { channel: YoutubeChannel; count: number }>();
    endedStreams.forEach((stream) => {
      const chId = stream.channel.id;
      if (!map.has(chId)) {
        map.set(chId, { channel: stream.channel, count: 0 });
      }
      map.get(chId)!.count++;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [endedStreams]);

  // Channel aktif yang dipilih pada filter pill (jika bukan 'all')
  const selectedEndedChannel = useMemo(() => {
    if (selectedEndedChannelId === 'all') return null;
    return endedChannelsList.find((c) => c.channel.id === selectedEndedChannelId)?.channel || null;
  }, [selectedEndedChannelId, endedChannelsList]);

  // Reset paginasi saat kata kunci pencarian atau filter channel berubah
  useEffect(() => {
    setVisibleEndedCount(12);
  }, [debouncedSearchQuery, selectedEndedChannelId]);

  const hasMoreEnded = visibleEndedCount < filteredEndedStreams.length;

  const handleLoadMoreEnded = useCallback(() => {
    if (isLoadingMoreEnded || !hasMoreEnded) return;
    setIsLoadingMoreEnded(true);
    setTimeout(() => {
      setVisibleEndedCount((prev) => prev + 9);
      setIsLoadingMoreEnded(false);
    }, 350);
  }, [isLoadingMoreEnded, hasMoreEnded]);

  useEffect(() => {
    if (activeTab !== 'ended' || !hasMoreEnded) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMoreEnded();
        }
      },
      { rootMargin: '300px' }
    );

    const currentRef = loadMoreEndedRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [activeTab, hasMoreEnded, handleLoadMoreEnded]);

  // Daftar rekaman yang ditampilkan pada halaman saat ini (terbatasi oleh infinite scroll)
  const visibleEndedStreams = useMemo(() => {
    return filteredEndedStreams.slice(0, visibleEndedCount);
  }, [filteredEndedStreams, visibleEndedCount]);

  // Filter pencarian untuk channel (khusus admin, deduplikasi handle, debounced 300ms)
  const filteredAllChannels = useMemo(() => {
    const map = new Map<string, YoutubeChannel>();
    channels.forEach((c) => {
      const normHandle = (c.channel_handle || '').toLowerCase().trim();
      if (!map.has(normHandle)) {
        map.set(normHandle, c);
      }
    });
    const uniqueChannels = Array.from(map.values());

    return uniqueChannels.filter((c) => {
      const q = debouncedSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        c.channel_name.toLowerCase().includes(q) ||
        c.channel_handle.toLowerCase().includes(q) ||
        (c.default_speaker_name && c.default_speaker_name.toLowerCase().includes(q))
      );
    });
  }, [channels, debouncedSearchQuery]);

  return (
    <div className="min-h-screen bg-surface font-geist text-on-surface flex flex-col">
      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container-high/60 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Sisi Kiri: Tombol Back ke Peta & Logo */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-colors shrink-0"
              title="Kembali ke Peta Kajian"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span className="hidden sm:inline">Peta Kajian</span>
            </Link>

            <div className="h-5 w-px bg-surface-container-high hidden sm:block shrink-0" />

            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-red-600/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center font-bold shrink-0">
                <span className="material-symbols-outlined text-[19px]">smart_display</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-xs sm:text-base leading-tight truncate">Live Kajian</h1>
                  {/* Badge Live Ringkas di Layar Mobile */}
                  {liveChannels.length > 0 ? (
                    <span className="sm:hidden inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-bold shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      {liveChannels.length} Live
                    </span>
                  ) : upcomingStreams.length > 0 ? (
                    <span className="sm:hidden inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[9px] font-bold shrink-0">
                      <span className="material-symbols-outlined text-[11px]">schedule</span>
                      {upcomingStreams.length} Terjadwal
                    </span>
                  ) : endedStreams.length > 0 ? (
                    <span className="sm:hidden inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-bold shrink-0">
                      <span className="material-symbols-outlined text-[11px]">history</span>
                      {endedStreams.length} Rekaman
                    </span>
                  ) : null}
                </div>
                <p className="text-[10px] sm:text-[11px] text-outline truncate hidden xs:block">
                  Siaran Langsung Kajian Islam
                </p>
              </div>
            </div>
          </div>

          {/* Sisi Kanan: Status Counter & Menu Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Pill Badge Sedang Live (Desktop Only) */}
            {liveChannels.length > 0 ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold shadow-xs animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>{liveChannels.length} Sedang Live</span>
              </div>
            ) : upcomingStreams.length > 0 ? (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-bold shadow-xs">
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                <span>{upcomingStreams.length} Siaran Terjadwal</span>
              </div>
            ) : endedStreams.length > 0 ? (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30 text-xs font-bold shadow-xs">
                <span className="material-symbols-outlined text-[14px]">history</span>
                <span>{endedStreams.length} Rekaman Tersedia</span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-xs font-medium text-outline">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                <span>Belum Ada Siaran Aktif</span>
              </div>
            )}

            {/* Tombol Pengalih Tema */}
            <ThemeToggle variant="icon" />

            {/* Tombol Refresh */}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-on-surface-variant hover:bg-surface-container flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              title="Perbarui Data"
            >
              <span className={`material-symbols-outlined text-[18px] sm:text-[20px] ${isFetching ? 'animate-spin' : ''}`}>
                refresh
              </span>
            </button>

            {/* Menu Drawer Mobile */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="md:hidden w-8 h-8 rounded-xl text-on-surface-variant hover:bg-surface-container flex items-center justify-center transition-colors shrink-0"
              title="Menu Navigasi"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION / BANNER */}
      <section className="bg-gradient-to-b from-surface-container-low to-surface py-5 sm:py-8 px-3.5 sm:px-6 border-b border-surface-container-high/40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[11px] sm:text-xs font-semibold mb-2 sm:mb-3 border border-red-200 dark:border-red-900/50">
              <span className="material-symbols-outlined text-[15px] sm:text-[16px] text-red-600">live_tv</span>
              <span>Pusat Siaran Live & Jadwal Tayang</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
              Kajian Islam Live Langsung dari Rumah
            </h2>
            <p className="text-xs sm:text-sm text-outline mt-1.5 sm:mt-2 leading-relaxed">
              Pantau siaran langsung kajian dan jadwal tayang mendatang (Premiere) dari channel dakwah dan asatidzah secara real-time.
            </p>
          </div>

          {/* Quick Filter & Search Bar */}
          <div className="w-full md:w-80 flex flex-col gap-1.5 mt-1 sm:mt-0">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-outline">
                search
              </span>
              <input
                type="text"
                placeholder={
                  activeTab === 'upcoming'
                    ? 'Cari jadwal tayang atau ustadz...'
                    : isAdmin
                    ? 'Cari channel, ustadz, atau judul...'
                    : 'Cari siaran live atau ustadz...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 sm:py-2.5 rounded-xl bg-surface-container-lowest border border-surface-container-high text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-1"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                </button>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-outline px-1">
              {activeTab === 'live'
                ? liveChannels.length > 0
                  ? `${liveChannels.length} siaran langsung tersedia saat ini`
                  : 'Tidak ada siaran live berlangsung'
                : activeTab === 'upcoming'
                ? upcomingStreams.length > 0
                  ? `${upcomingStreams.length} siaran terjadwal dalam 24–48 jam`
                  : 'Belum ada siaran terjadwal'
                : endedStreams.length > 0
                ? `${endedStreams.length} rekaman siaran kajian tersedia`
                : 'Belum ada rekaman siaran'}
            </p>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 py-6 sm:py-8 flex-1 w-full">
        {loading ? (
          <EndedStreamSkeleton count={6} />
        ) : hasError && channels.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 max-w-md mx-auto flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-2xs">
              <span className="material-symbols-outlined text-[32px]">wifi_off</span>
            </div>
            <div>
              <p className="font-bold text-base text-on-surface">Tidak Ada Koneksi Internet</p>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                Gagal memuat siaran langsung. Periksa koneksi internet Anda lalu coba lagi.
              </p>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              <span>Coba Lagi</span>
            </button>
          </div>
        ) : (
          <>
            {/* TAB NAVIGATION: SEDANG LIVE, AKAN TAYANG, & REKAMAN SELESAI */}
            <div className="flex items-center gap-2 border-b border-surface-container-high pb-px mb-6 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('live')}
                className={`flex items-center gap-2 px-4 py-3 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'live'
                    ? 'border-red-600 text-red-600 dark:text-red-400'
                    : 'border-transparent text-outline hover:text-on-surface'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    liveChannels.length > 0 ? 'bg-red-600 animate-pulse' : 'bg-outline/50'
                  }`}
                />
                <span>Sedang Live</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-colors ${
                    activeTab === 'live'
                      ? 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300'
                      : 'bg-surface-container text-outline'
                  }`}
                >
                  {liveChannels.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('upcoming')}
                className={`flex items-center gap-2 px-4 py-3 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'upcoming'
                    ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-outline hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">schedule</span>
                <span>Akan Tayang</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-colors ${
                    activeTab === 'upcoming'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                      : 'bg-surface-container text-outline'
                  }`}
                >
                  {upcomingStreams.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ended')}
                className={`flex items-center gap-2 px-4 py-3 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'ended'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-outline hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">history</span>
                <span>Rekaman Selesai</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-colors ${
                    activeTab === 'ended'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'
                      : 'bg-surface-container text-outline'
                  }`}
                >
                  {endedStreams.length}
                </span>
              </button>
            </div>

            {/* TAB CONTENT 1: SEDANG LIVE */}
            {activeTab === 'live' && (
              liveChannels.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
                      <h3 className="font-extrabold text-lg sm:text-xl text-on-surface tracking-tight">
                        Sedang Tayang Langsung ({filteredLiveChannels.length})
                      </h3>
                    </div>
                    <span className="text-xs text-outline hidden sm:inline">Diperbarui otomatis</span>
                  </div>

                  {filteredLiveChannels.length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60">
                      <span className="material-symbols-outlined text-[32px] text-outline mb-2">search_off</span>
                      <p className="text-sm font-semibold text-on-surface">Tidak ada siaran live yang cocok</p>
                      <p className="text-xs text-outline mt-1">Coba kata kunci pencarian yang lain.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredLiveChannels.map((channel) => {
                        const videoId = channel.current_video_id!;
                        const title = channel.current_video_title || `Live Streaming ${channel.channel_name}`;
                        const posterUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                        const streamUrl = `https://www.youtube.com/watch?v=${videoId}`;
                        const speaker = channel.default_speaker_name || 'Asatidzah';

                        return (
                          <div
                            key={channel.id}
                            className="group relative rounded-2xl bg-surface-container-lowest border-2 border-red-500/40 hover:border-red-500 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden"
                          >
                            {/* Video Thumbnail Area */}
                            <div
                              className="relative aspect-video w-full bg-black cursor-pointer overflow-hidden"
                              onClick={() =>
                                setSelectedVideo({
                                  videoId,
                                  title,
                                  channelName: channel.channel_name,
                                  speakerName: speaker,
                                })
                              }
                            >
                              <img
                                src={posterUrl}
                                alt={title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                                {/* Play Button Overlay */}
                                <div className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                  <span className="material-symbols-outlined text-[32px] ml-0.5">
                                    play_arrow
                                  </span>
                                </div>
                              </div>

                              {/* Live Badge */}
                              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600 text-white text-[11px] font-bold shadow-md tracking-wider">
                                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                <span>LIVE</span>
                              </div>
                            </div>

                            {/* Video Details */}
                            <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="material-symbols-outlined text-[16px] text-red-600">
                                    verified
                                  </span>
                                  <span className="text-xs font-bold text-on-surface-variant truncate">
                                    {channel.channel_name}
                                  </span>
                                </div>
                                <h4
                                  className="font-bold text-sm sm:text-base text-on-surface line-clamp-2 leading-snug cursor-pointer hover:text-red-600 transition-colors"
                                  onClick={() =>
                                    setSelectedVideo({
                                      videoId,
                                      title,
                                      channelName: channel.channel_name,
                                      speakerName: speaker,
                                    })
                                  }
                                >
                                  {title}
                                </h4>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 pt-3 border-t border-surface-container-high/60">
                                <button
                                  onClick={() =>
                                    setSelectedVideo({
                                      videoId,
                                      title,
                                      channelName: channel.channel_name,
                                      speakerName: speaker,
                                    })
                                  }
                                  className="flex-1 h-9 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[18px]">play_circle</span>
                                  <span>Tonton</span>
                                </button>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Tombol Putar Mini Player (PiP) */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      playStream({
                                        videoId,
                                        title,
                                        channelName: channel.channel_name,
                                        speakerName: speaker,
                                        handle: channel.channel_handle,
                                      })
                                    }
                                    className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high text-outline hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                    title="Putar di Mini Player (PiP pojok bawah)"
                                    aria-label="Putar di Mini Player"
                                  >
                                    <span className="material-symbols-outlined text-[19px]">picture_in_picture_alt</span>
                                  </button>

                                  {/* Tombol Mode Belajar & Catat Faidah */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenStudyNotes({
                                        videoId,
                                        title,
                                        channelName: channel.channel_name,
                                        speakerName: speaker,
                                        sessionId: channel.current_session_id || undefined,
                                      })
                                    }
                                    className={`${
                                      FEATURE_FLAGS.ENABLE_MOBILE_STUDY_NOTES ? 'flex' : 'hidden md:flex'
                                    } w-9 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 items-center justify-center transition-colors cursor-pointer shrink-0`}
                                    title="Mode Belajar & Catat Faidah (Wajib Login)"
                                    aria-label="Mode Belajar"
                                  >
                                    <span className="material-symbols-outlined text-[19px]">edit_note</span>
                                  </button>

                                  {/* External YouTube Link */}
                                  <a
                                    href={streamUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high text-outline hover:text-red-600 flex items-center justify-center transition-colors shrink-0"
                                    title="Buka di YouTube"
                                    aria-label="Buka di YouTube"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* EMPTY STATE JIKA TIDAK ADA YANG LIVE */
                <div className="text-center py-16 px-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 max-w-lg mx-auto">
                  <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto text-outline mb-4">
                    <span className="material-symbols-outlined text-[32px]">live_tv</span>
                  </div>
                  <h3 className="font-bold text-lg text-on-surface">Belum Ada Kajian Live Saat Ini</h3>
                  <p className="text-xs text-outline mt-1.5 leading-relaxed">
                    Saat ini belum ada siaran langsung kajian yang sedang berlangsung. Silakan periksa kembali saat waktu kajian tiba atau lihat siaran yang akan tayang.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
                    {upcomingStreams.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('upcoming')}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">schedule</span>
                        <span>Jadwal Akan Tayang ({upcomingStreams.length})</span>
                      </button>
                    )}
                    {endedStreams.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('ended')}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">history</span>
                        <span>Lihat Rekaman Selesai ({endedStreams.length})</span>
                      </button>
                    )}
                    <Link
                      href="/"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">map</span>
                      <span>Jelajahi Peta Kajian</span>
                    </Link>
                  </div>
                </div>
              )
            )}

            {/* TAB CONTENT 2: AKAN TAYANG (UPCOMING) */}
            {activeTab === 'upcoming' && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-[22px]">schedule</span>
                    <h3 className="font-extrabold text-lg sm:text-xl text-on-surface tracking-tight">
                      Siaran Terjadwal Mendatang ({filteredUpcomingStreams.length})
                    </h3>
                  </div>
                  <span className="text-xs text-outline hidden sm:inline">Terjadwal 24–48 jam ke depan</span>
                </div>

                {filteredUpcomingStreams.length === 0 ? (
                  upcomingStreams.length === 0 ? (
                    <div className="text-center py-16 px-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 max-w-lg mx-auto">
                      <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-[32px]">event_upcoming</span>
                      </div>
                      <h3 className="font-bold text-lg text-on-surface">Belum Ada Jadwal Siaran Mendatang</h3>
                      <p className="text-xs text-outline mt-1.5 leading-relaxed">
                        Belum ada channel dakwah yang menjadwalkan siaran langsung atau premiere dalam waktu 24–48 jam ke depan. Cek siaran yang sedang live atau jelajahi peta kajian.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
                        {liveChannels.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('live')}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">live_tv</span>
                            <span>Lihat Siaran Live ({liveChannels.length})</span>
                          </button>
                        )}
                        {endedStreams.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('ended')}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">history</span>
                            <span>Lihat Rekaman Selesai ({endedStreams.length})</span>
                          </button>
                        )}
                        <Link
                          href="/"
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-all shadow-xs"
                        >
                          <span className="material-symbols-outlined text-[16px]">map</span>
                          <span>Peta Kajian</span>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 px-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60">
                      <span className="material-symbols-outlined text-[32px] text-outline mb-2">search_off</span>
                      <p className="text-sm font-semibold text-on-surface">Tidak ada jadwal siaran yang cocok</p>
                      <p className="text-xs text-outline mt-1">Coba kata kunci pencarian yang lain.</p>
                    </div>
                  )
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredUpcomingStreams.map((item) => {
                      const videoId = item.videoId;
                      const title = item.title;
                      const posterUrl = item.posterUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                      const streamUrl = `https://www.youtube.com/watch?v=${videoId}`;
                      const speaker = item.speakerName || item.channel.default_speaker_name || 'Asatidzah';
                      const timeBadge = formatUpcomingTime(item.scheduledStartTime);

                      return (
                        <div
                          key={`${item.channel.id}-${videoId}`}
                          className="group relative rounded-2xl bg-surface-container-lowest border-2 border-amber-500/30 hover:border-amber-500 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden"
                        >
                          {/* Video Thumbnail Area */}
                          <div
                            className="relative aspect-video w-full bg-black cursor-pointer overflow-hidden"
                            onClick={() =>
                              setSelectedVideo({
                                videoId,
                                title,
                                channelName: item.channelName,
                                speakerName: speaker,
                              })
                            }
                          >
                            <img
                              src={posterUrl}
                              alt={title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                              {/* Play Button Overlay */}
                              <div className="w-14 h-14 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-[32px] ml-0.5">
                                  schedule
                                </span>
                              </div>
                            </div>

                            {/* Scheduled Time Badge */}
                            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-600 text-white text-[11px] font-bold shadow-md tracking-wide">
                              <span className="material-symbols-outlined text-[13px]">alarm</span>
                              <span>{timeBadge}</span>
                            </div>
                          </div>

                          {/* Video Details */}
                          <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="material-symbols-outlined text-[16px] text-amber-600">
                                  verified
                                </span>
                                <span className="text-xs font-bold text-on-surface-variant truncate">
                                  {item.channelName}
                                </span>
                              </div>
                              <h4
                                className="font-bold text-sm sm:text-base text-on-surface line-clamp-2 leading-snug cursor-pointer hover:text-amber-600 transition-colors"
                                onClick={() =>
                                  setSelectedVideo({
                                    videoId,
                                    title,
                                    channelName: item.channelName,
                                    speakerName: speaker,
                                  })
                                }
                              >
                                {title}
                              </h4>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 pt-3 border-t border-surface-container-high/60">
                              <button
                                onClick={() =>
                                  setSelectedVideo({
                                    videoId,
                                    title,
                                    channelName: item.channelName,
                                    speakerName: speaker,
                                  })
                                }
                                className="flex-1 h-9 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]">play_circle</span>
                                <span>Waiting Room</span>
                              </button>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Tombol Putar Mini Player (PiP) */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    playStream({
                                      videoId,
                                      title,
                                      channelName: item.channelName,
                                      speakerName: speaker,
                                      handle: item.channel.channel_handle,
                                    })
                                  }
                                  className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high text-outline hover:text-amber-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                  title="Buka di Mini Player (PiP pojok bawah)"
                                  aria-label="Buka di Mini Player"
                                >
                                  <span className="material-symbols-outlined text-[19px]">picture_in_picture_alt</span>
                                </button>

                                {/* External YouTube Link */}
                                <a
                                  href={streamUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high text-outline hover:text-amber-600 flex items-center justify-center transition-colors shrink-0"
                                  title="Buka di YouTube"
                                  aria-label="Buka di YouTube"
                                >
                                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 3: REKAMAN SELESAI TAYANG (ENDED STREAMS) */}
            {activeTab === 'ended' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[22px]">
                      history
                    </span>
                    <h3 className="font-extrabold text-lg sm:text-xl text-on-surface tracking-tight">
                      Rekaman Siaran Selesai ({filteredEndedStreams.length})
                    </h3>
                  </div>
                  <span className="text-xs text-outline hidden sm:inline">Dapat diputar ulang kapan saja</span>
                </div>

                {/* FILTER CHANNEL BAR (HORIZONTAL SCROLL PILLS) */}
                {endedStreams.length > 0 && endedChannelsList.length > 0 && (
                  <div className="mb-6 -mx-1 px-1 overflow-x-auto no-scrollbar pb-1">
                    <div className="flex items-center gap-2 min-w-max">
                      {/* Tombol Semua Channel */}
                      <button
                        type="button"
                        onClick={() => setSelectedEndedChannelId('all')}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          selectedEndedChannelId === 'all'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">apps</span>
                        <span>Semua Channel</span>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            selectedEndedChannelId === 'all'
                              ? 'bg-white/20 text-white'
                              : 'bg-surface-container-high text-outline'
                          }`}
                        >
                          {endedStreams.length}
                        </span>
                      </button>

                      {/* Tombol Tiap Channel */}
                      {endedChannelsList.map(({ channel, count }) => {
                        const isSelected = selectedEndedChannelId === channel.id;
                        return (
                          <button
                            key={channel.id}
                            type="button"
                            onClick={() => setSelectedEndedChannelId(channel.id)}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white font-bold shadow-xs'
                                : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                            }`}
                          >
                            {channel.avatar_url ? (
                              <img
                                src={channel.avatar_url}
                                alt={channel.channel_name}
                                className="w-5 h-5 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                }`}
                              >
                                {channel.channel_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="max-w-[140px] sm:max-w-[200px] truncate">
                              {channel.channel_name}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-surface-container-high text-outline'
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ACTIVE FILTER BANNER (JIKA FILTER CHANNEL DIPILIH) */}
                {selectedEndedChannelId !== 'all' && (
                  <div className="flex items-center justify-between gap-2 p-2.5 sm:px-4 sm:py-2.5 mb-6 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-500/20 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px] shrink-0">
                        filter_alt
                      </span>
                      <span className="text-on-surface truncate">
                        Menampilkan rekaman dari: <strong>{endedChannelsList.find((c) => c.channel.id === selectedEndedChannelId)?.channel.channel_name || 'Channel Terpilih'}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedEndedChannelId('all')}
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold hover:underline shrink-0 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                      <span>Tampilkan Semua</span>
                    </button>
                  </div>
                )}

                {filteredEndedStreams.length === 0 ? (
                  endedStreams.length === 0 ? (
                    <div className="text-center py-16 px-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 max-w-lg mx-auto">
                      <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-[32px]">history_toggle_off</span>
                      </div>
                      <h3 className="font-bold text-lg text-on-surface">Belum Ada Rekaman Siaran Selesai</h3>
                      <p className="text-xs text-outline mt-1.5 leading-relaxed">
                        Belum ada arsip rekaman siaran langsung yang baru saja berakhir. Cek siaran yang sedang live atau jelajahi jadwal yang akan datang.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
                        {liveChannels.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('live')}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">live_tv</span>
                            <span>Lihat Siaran Live ({liveChannels.length})</span>
                          </button>
                        )}
                        {upcomingStreams.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('upcoming')}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">schedule</span>
                            <span>Jadwal Akan Tayang ({upcomingStreams.length})</span>
                          </button>
                        )}
                        <Link
                          href="/"
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-all shadow-xs"
                        >
                          <span className="material-symbols-outlined text-[16px]">map</span>
                          <span>Peta Kajian</span>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 px-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60">
                      <span className="material-symbols-outlined text-[32px] text-outline mb-2">search_off</span>
                      <p className="text-sm font-semibold text-on-surface">Tidak ada rekaman siaran yang cocok</p>
                      <p className="text-xs text-outline mt-1">Coba ubah kata kunci pencarian atau ganti filter channel.</p>
                      {(searchQuery || selectedEndedChannelId !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedEndedChannelId('all');
                          }}
                          className="mt-3 inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-colors cursor-pointer"
                        >
                          <span>Reset Pencarian & Filter</span>
                        </button>
                      )}
                    </div>
                  )
                ) : (
                  <div>
                    {/* Header Banner Channel Terpilih (Jika Memfilter ke 1 Channel) */}
                    {selectedEndedChannel && (
                      <div className="flex items-center justify-between p-3.5 sm:p-4 mb-6 rounded-2xl bg-surface-container-low border border-surface-container-high/60 shadow-2xs">
                        <div className="flex items-center gap-3 min-w-0">
                          {selectedEndedChannel.avatar_url ? (
                            <img
                              src={selectedEndedChannel.avatar_url}
                              alt={selectedEndedChannel.channel_name}
                              className="w-10 h-10 rounded-full object-cover border border-surface-container-high shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-sm shrink-0 border border-blue-500/20">
                              {selectedEndedChannel.channel_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm sm:text-base text-on-surface truncate">
                                {selectedEndedChannel.channel_name}
                              </h4>
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold shrink-0">
                                {filteredEndedStreams.length} Rekaman
                              </span>
                            </div>
                            <p className="text-xs text-outline truncate">
                              {selectedEndedChannel.channel_handle}
                              {selectedEndedChannel.default_speaker_name ? ` • ${selectedEndedChannel.default_speaker_name}` : ''}
                            </p>
                          </div>
                        </div>

                        <a
                          href={`https://www.youtube.com/${selectedEndedChannel.channel_handle.replace(/^@/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hidden sm:inline-flex items-center gap-1 text-xs text-outline hover:text-blue-600 dark:hover:text-blue-400 transition-colors shrink-0"
                          title="Kunjungi Channel di YouTube"
                        >
                          <span>Kunjungi Channel</span>
                          <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                        </a>
                      </div>
                    )}

                    {/* Grid Terpadu Rekaman Selesai Berdasarkan Waktu Selesai Terbaru */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {visibleEndedStreams.map((item) => {
                        const videoId = item.videoId;
                        const title = item.title;
                        const posterUrl = item.posterUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                        const streamUrl = `https://www.youtube.com/watch?v=${videoId}`;
                        const speaker = item.speakerName || item.channel.default_speaker_name || 'Asatidzah';
                        const timeBadge = item.endedAt ? formatEndedTime(item.endedAt) : 'Selesai Tayang';

                        return (
                          <div
                            key={`${item.channel.id}-${videoId}`}
                            className="group relative rounded-2xl bg-surface-container-lowest border-2 border-blue-500/30 hover:border-blue-500 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden"
                          >
                            {/* Video Thumbnail Area */}
                            <div
                              className="relative aspect-video w-full bg-black cursor-pointer overflow-hidden"
                              onClick={() =>
                                playStream({
                                  videoId,
                                  title,
                                  channelName: item.channelName,
                                  speakerName: speaker,
                                  handle: item.channel.channel_handle,
                                })
                              }
                            >
                              <img
                                src={posterUrl}
                                alt={title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                                {/* Play Button Overlay */}
                                <div className="w-14 h-14 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                  <span className="material-symbols-outlined text-[32px] ml-1">
                                    play_arrow
                                  </span>
                                </div>
                              </div>

                              {/* Ended Time Badge */}
                              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600 text-white text-[11px] font-bold shadow-md tracking-wide">
                                <span className="material-symbols-outlined text-[13px]">history</span>
                                <span>{timeBadge}</span>
                              </div>

                              {/* Rekaman Label */}
                              <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/75 text-white text-[10px] font-medium backdrop-blur-xs">
                                Rekaman
                              </div>
                            </div>

                            {/* Video Details */}
                            <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                              <div>
                                {/* Channel & Avatar Info */}
                                <div
                                  className="flex items-center gap-2 mb-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => setSelectedEndedChannelId(item.channel.id)}
                                  title={`Filter hanya channel ${item.channelName}`}
                                >
                                  {item.channel.avatar_url ? (
                                    <img
                                      src={item.channel.avatar_url}
                                      alt={item.channelName}
                                      className="w-4 h-4 rounded-full object-cover shrink-0"
                                    />
                                  ) : (
                                    <span className="material-symbols-outlined text-[16px] text-blue-600 dark:text-blue-400 shrink-0">
                                      account_circle
                                    </span>
                                  )}
                                  <span className="text-xs font-bold text-on-surface-variant truncate">
                                    {item.channelName}
                                  </span>
                                </div>

                                <h4
                                  className="font-bold text-sm sm:text-base text-on-surface line-clamp-2 leading-snug cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                  onClick={() =>
                                    playStream({
                                      videoId,
                                      title,
                                      channelName: item.channelName,
                                      speakerName: speaker,
                                      handle: item.channel.channel_handle,
                                    })
                                  }
                                  title={title}
                                >
                                  {title}
                                </h4>
                                <p className="text-xs text-outline mt-1 truncate">
                                  Pemateri: <span className="text-on-surface font-medium">{speaker}</span>
                                </p>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 pt-3 border-t border-surface-container-high/60">
                                <button
                                  onClick={() =>
                                    playStream({
                                      videoId,
                                      title,
                                      channelName: item.channelName,
                                      speakerName: speaker,
                                      handle: item.channel.channel_handle,
                                    })
                                  }
                                  className="flex-1 h-9 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                                  <span>Putar Rekaman</span>
                                </button>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Tombol Putar Mini Player (PiP) */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      playStream({
                                        videoId,
                                        title,
                                        channelName: item.channelName,
                                        speakerName: speaker,
                                        handle: item.channel.channel_handle,
                                      })
                                    }
                                    className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high text-outline hover:text-blue-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                    title="Buka di Mini Player (PiP pojok bawah)"
                                    aria-label="Buka di Mini Player"
                                  >
                                    <span className="material-symbols-outlined text-[19px]">picture_in_picture_alt</span>
                                  </button>

                                  {/* Tombol Mode Belajar & Catat Faidah */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenStudyNotes({
                                        videoId,
                                        title,
                                        channelName: item.channelName,
                                        speakerName: speaker,
                                      })
                                    }
                                    className={`${
                                      FEATURE_FLAGS.ENABLE_MOBILE_STUDY_NOTES ? 'flex' : 'hidden md:flex'
                                    } w-9 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 items-center justify-center transition-colors cursor-pointer shrink-0`}
                                    title="Mode Belajar & Catat Faidah (Wajib Login)"
                                    aria-label="Mode Belajar"
                                  >
                                    <span className="material-symbols-outlined text-[19px]">edit_note</span>
                                  </button>

                                  {/* External YouTube Link */}
                                  <a
                                    href={streamUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high text-outline hover:text-blue-600 flex items-center justify-center transition-colors shrink-0"
                                    title="Buka di YouTube"
                                    aria-label="Buka di YouTube"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Skeleton Loader saat memuat batch berikutnya */}
                    {isLoadingMoreEnded && (
                      <div className="mt-6">
                        <EndedStreamSkeleton count={3} />
                      </div>
                    )}

                    {/* Sentinel Trigger Infinite Scroll */}
                    <div ref={loadMoreEndedRef} className="h-10 w-full pointer-events-none" />

                    {/* Indikator Seluruh Rekaman Selesai Dimuat */}
                    {!hasMoreEnded && filteredEndedStreams.length > 12 && (
                      <div className="text-center py-8 text-xs font-semibold text-outline">
                        Menampilkan seluruh {filteredEndedStreams.length} rekaman siaran
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* BAGIAN 2: DAFTAR SELURUH CHANNEL DAKWAH YANG DIPANTAU (KHUSUS ADMIN) */}
            {isAdmin && (
              <div className="mt-14 pt-8 border-t border-surface-container-high/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 text-[10px] font-bold border border-purple-200 dark:border-purple-800">
                        Akses Khusus Admin
                      </span>
                      <h3 className="font-extrabold text-lg sm:text-xl text-on-surface tracking-tight">
                        Channel Dakwah yang Dipantau ({filteredAllChannels.length})
                      </h3>
                    </div>
                    <p className="text-xs text-outline mt-1">
                      Bagian ini hanya dapat dilihat oleh administrator untuk memantau status bot tracker.
                    </p>
                  </div>

                  <Link
                    href="/admin/youtube"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-colors w-fit"
                  >
                    <span className="material-symbols-outlined text-[18px]">settings</span>
                    <span>Kelola YouTube Admin</span>
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAllChannels.map((channel) => {
                    const handleClean = channel.channel_handle.replace(/^@/, '');
                    const channelUrl = `https://www.youtube.com/@${handleClean}`;
                    const liveUrl = `https://www.youtube.com/@${handleClean}/live`;

                    return (
                      <div
                        key={channel.id}
                        className="rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 p-4 hover:border-purple-300 dark:hover:border-purple-800 transition-all flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-red-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                              {channel.channel_name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm text-on-surface truncate">
                                {channel.channel_name}
                              </h4>
                              <p className="text-[11px] text-outline truncate font-mono">
                                {channel.channel_handle}
                              </p>
                              <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                                {channel.default_speaker_name || 'Asatidzah'}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {channel.is_currently_live ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                LIVE
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container text-outline text-[10px] font-medium">
                                Offline
                              </span>
                            )}
                            {channel.upcoming_streams && channel.upcoming_streams.length > 0 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[9px] font-bold">
                                <span className="material-symbols-outlined text-[11px]">schedule</span>
                                <span>{channel.upcoming_streams.length} Terjadwal</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-surface-container-high/40 text-xs">
                          <span className="text-[11px] text-outline">
                            Kota: <strong className="text-on-surface">{channel.default_city || 'Nasional'}</strong>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <a
                              href={channelUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-[11px] font-semibold text-on-surface transition-colors flex items-center gap-1"
                            >
                              <span>Channel</span>
                              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                            </a>
                            <a
                              href={liveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 text-[11px] font-bold transition-colors flex items-center gap-1"
                            >
                              <span>Live</span>
                              <span className="material-symbols-outlined text-[13px]">videocam</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-surface-container-high/60 bg-surface-container-lowest py-6 text-center text-xs text-outline mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Peta Kajian — Pelacak Kajian & Siaran Langsung Kajian Islam</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-on-surface transition-colors">
              Peta Kajian
            </Link>
            <Link href="/faq" className="hover:text-on-surface transition-colors">
              Bantuan & FAQ
            </Link>
            {isAdmin && (
              <Link href="/admin/youtube" className="text-purple-600 font-semibold hover:underline">
                Kelola YouTube Admin
              </Link>
            )}
          </div>
        </div>
      </footer>

      {/* MODAL EMBED VIDEO PLAYER */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col border border-surface-container-high">
            
            {/* Modal Header */}
            <div className="px-4 py-3 bg-surface-container flex items-center justify-between gap-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping shrink-0" />
                <h3 className="font-bold text-sm sm:text-base text-on-surface truncate">
                  {selectedVideo.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedVideo(null)}
                className="w-8 h-8 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-outline hover:text-on-surface transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Embed Video Iframe */}
            <div className="relative aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${selectedVideo.videoId}?autoplay=1&rel=0`}
                title={selectedVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="w-full h-full border-0"
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-surface-container-lowest flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-red-600">{selectedVideo.channelName}</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Tombol Mode Belajar */}
                <button
                  type="button"
                  onClick={() => {
                    handleOpenStudyNotes({
                      videoId: selectedVideo.videoId,
                      title: selectedVideo.title,
                      channelName: selectedVideo.channelName,
                      speakerName: selectedVideo.speakerName || '',
                    });
                    setSelectedVideo(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Buka Mode Belajar untuk menyimak sambil mencatat faidah"
                >
                  <span className="material-symbols-outlined text-[16px]">edit_note</span>
                  <span>Mode Belajar</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playStream({
                      videoId: selectedVideo.videoId,
                      title: selectedVideo.title,
                      channelName: selectedVideo.channelName,
                      speakerName: selectedVideo.speakerName || '',
                    });
                    setSelectedVideo(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Lanjutkan di Mini Player pojok kanan bawah"
                >
                  <span className="material-symbols-outlined text-[16px] text-red-600">picture_in_picture_alt</span>
                  <span>Putar di Pojok</span>
                </button>
                <a
                  href={`https://www.youtube.com/watch?v=${selectedVideo.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>YouTube</span>
                </a>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="px-4 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AJAKAN LOGIN KHUSUS MODE BELAJAR DARI CARD LIVE */}
      <StudyLoginModal
        isOpen={!!pendingStudyLogin}
        onClose={() => setPendingStudyLogin(null)}
        pendingSession={pendingStudyLogin}
      />

      {/* MOBILE NAV DRAWER */}
      <MobileNavDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentUser={
          currentUser
            ? {
                name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || null,
                email: currentUser.email || null,
                avatarUrl: currentUser.user_metadata?.avatar_url || null,
                role: isAdmin ? 'admin' : undefined,
              }
            : null
        }
        isAdmin={isAdmin}
      />
    </div>
  );
}

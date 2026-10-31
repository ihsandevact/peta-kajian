'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { createClient } from '@/utils/supabase/client';
import {
  type YoutubeChannel,
  type UpcomingStreamItem,
  type EndedStreamItem,
  formatUpcomingTime,
  formatEndedTime,
} from '@/lib/services/youtubeTracker';
import { checkIsAdmin } from '@/lib/services/admin';
import { useLivePlayer } from '@/context/LivePlayerContext';
import { FEATURE_FLAGS } from '@/config/features';
import { useYoutubeChannelsQuery } from '@/lib/hooks/useYoutubeChannelsQuery';
import EndedStreamSkeleton, { YoutubeGridSkeleton } from '@/components/live/EndedStreamSkeleton';
import LiveWatchViewSkeleton from '@/components/live/LiveWatchViewSkeleton';
import YoutubeVideoCard from '@/components/live/YoutubeVideoCard';
import DesktopYoutubeWatchView, { type WatchVideoData } from '@/components/live/DesktopYoutubeWatchView';
import { type PendingStudySession } from '@/utils/studyNotes';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useBottomNav } from '@/context/BottomNavContext';
import DynamicBackButton from '@/components/navigation/DynamicBackButton';

const StudyLoginModal = dynamic(() => import('@/components/StudyLoginModal'), {
  ssr: false,
});

const MobileYoutubeLiveViewer = dynamic(
  () => import('@/components/live/MobileYoutubeLiveViewer'),
  { ssr: false }
);

export default function LiveStreamingPage() {
  const {
    playStream,
    openStudyMode,
    closePlayer,
    isOpen: isLivePlayerOpen,
    activeStream,
    isStudyNotesOpen,
  } = useLivePlayer();
  const { setIsDarkTheme } = useBottomNav();
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
  const [selectedVideo, setSelectedVideo] = useState<WatchVideoData | null>(null);

  // Status apakah video terpilih sedang diputar via floating mini player
  const isMiniPlayerActive = isLivePlayerOpen && activeStream?.videoId === selectedVideo?.videoId;

  // Deteksi reaktif layar mobile (< 640px)
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileScreen(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sinkronkan tema Bottom Nav (default normal)
  useEffect(() => {
    setIsDarkTheme(false);
    return () => {
      setIsDarkTheme(false);
    };
  }, [setIsDarkTheme]);

  // Listener event untuk mengembalikan video dari floating mini player ke player utama saat Maximize diklik
  useEffect(() => {
    const handleRestoreEvent = (e: Event) => {
      const customEvt = e as CustomEvent<{
        videoId: string;
        title: string;
        channelName: string;
        speakerName?: string;
      }>;
      if (customEvt.detail) {
        setSelectedVideo((prev) => ({
          videoId: customEvt.detail.videoId,
          title: customEvt.detail.title,
          channelName: customEvt.detail.channelName,
          speakerName: customEvt.detail.speakerName,
          avatarUrl: prev?.avatarUrl,
          channelHandle: prev?.channelHandle,
          isLive: prev?.isLive ?? true,
        }));
        closePlayer();
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    };

    window.addEventListener('peta-kajian:restore-live-video', handleRestoreEvent);
    return () => {
      window.removeEventListener('peta-kajian:restore-live-video', handleRestoreEvent);
    };
  }, [closePlayer]);

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

  // Otomatis putar video live terkini di desktop saat halaman dimuat (Prioritas: Live -> Rekaman Terbaru)
  useEffect(() => {
    if (isMobileScreen || selectedVideo) return;
    const firstLive = liveChannels.find((c) => !!c.current_video_id);
    if (firstLive && firstLive.current_video_id) {
      setSelectedVideo({
        videoId: firstLive.current_video_id,
        title: firstLive.current_video_title || `Live Streaming ${firstLive.channel_name}`,
        channelName: firstLive.channel_name,
        speakerName: firstLive.default_speaker_name || '',
        avatarUrl: firstLive.avatar_url || undefined,
        isLive: true,
        channelHandle: firstLive.channel_handle || undefined,
        sessionId: firstLive.current_session_id || undefined,
      });
      setActiveTab('live');
    } else if (endedStreams.length > 0) {
      // Jika tidak ada siaran langsung, otomatis putar rekaman kajian terbaru
      const e = endedStreams[0];
      setSelectedVideo({
        videoId: e.videoId,
        title: e.title,
        channelName: e.channelName,
        speakerName: e.speakerName || e.channel.default_speaker_name || '',
        avatarUrl: e.channel.avatar_url || undefined,
        isLive: false,
        timeText: e.endedAt ? formatEndedTime(e.endedAt) : undefined,
        channelHandle: e.channel.channel_handle || undefined,
      });
      setActiveTab('ended');
    } else if (upcomingStreams.length > 0) {
      const u = upcomingStreams[0];
      setSelectedVideo({
        videoId: u.videoId,
        title: u.title,
        channelName: u.channelName,
        speakerName: u.speakerName || u.channel.default_speaker_name || '',
        avatarUrl: u.channel.avatar_url || undefined,
        isLive: false,
        timeText: formatUpcomingTime(u.scheduledStartTime),
        channelHandle: u.channel.channel_handle || undefined,
      });
      setActiveTab('upcoming');
    }
  }, [isMobileScreen, selectedVideo, liveChannels, upcomingStreams, endedStreams]);

  // Listener event saat pengguna mengetuk tab Live pada navigasi bawah
  useEffect(() => {
    const handleSwitchToSwipe = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('peta-kajian:switch-to-swipe', handleSwitchToSwipe);
    return () => {
      window.removeEventListener('peta-kajian:switch-to-swipe', handleSwitchToSwipe);
    };
  }, []);

  // Handler terpadu untuk menonton siaran (Desktop & Mobile)
  const handleWatchVideo = useCallback(
    (video: WatchVideoData) => {
      setSelectedVideo(video);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    []
  );

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

  // Tampilkan Skeleton View jika data saluran YouTube masih dimuat
  if (loading) {
    return <LiveWatchViewSkeleton />;
  }

  // Tampilkan Error View jika gagal terhubung dan tidak ada cache lokal
  if (hasError && channels.length === 0) {
    return (
      <div className="min-h-screen bg-surface font-geist text-on-surface flex flex-col items-center justify-center p-4">
        <div className="text-center py-12 px-6 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 max-w-md w-full flex flex-col items-center gap-3 shadow-md">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface font-geist text-on-surface flex flex-col pb-28 sm:pb-8">
      {/* TAMPILAN YOUTUBE-STYLE LIVE HUB KHUSUS MOBILE (< 640px) */}
      {isMobileScreen && (
        <div className="sm:hidden">
          <MobileYoutubeLiveViewer
            liveChannels={liveChannels}
            upcomingStreams={upcomingStreams}
            endedStreams={endedStreams}
            onOpenStudyMode={handleOpenStudyNotes}
            onSelectVideo={() => {
              if (isLivePlayerOpen) {
                closePlayer();
              }
            }}
            onPlayGlobalMiniPlayer={(stream) => {
              playStream({
                videoId: stream.videoId,
                title: stream.title,
                channelName: stream.channelName,
                speakerName: stream.speakerName || '',
              });
            }}
          />
        </div>
      )}

      {/* TAMPILAN KATALOG / GRID (DESKTOP >= 640px) */}
      <div className="hidden sm:flex flex-col flex-1">
        {/* TOP HEADER (HANYA DITAMPILKAN DI DESKTOP, DISEMBUNYIKAN DI MOBILE VIEW) */}
        <header className="hidden md:block sticky top-0 z-40 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container-high/60 shadow-xs">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
            
            {/* Sisi Kiri: Tombol Back Dinamis & Logo */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <DynamicBackButton className="bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl px-3 py-1.5" />

              <div className="h-5 w-px bg-surface-container-high hidden sm:block shrink-0" />

              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-red-600/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-[19px]">smart_display</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h1 className="font-bold text-xs sm:text-base leading-tight truncate">Live Kajian</h1>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-outline truncate hidden xs:block">
                    Siaran Langsung Kajian Islam
                  </p>
                </div>
              </div>
            </div>

            {/* Sisi Tengah: Search Bar YouTube Desktop */}
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[17px] text-outline">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Cari saluran, judul kajian, atau ustadz..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container focus:bg-surface-container-lowest border border-surface-container-high text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-all shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface cursor-pointer p-0.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                )}
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

              <Link
                href="/peta"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors"
                title="Buka Peta Kajian"
              >
                <span className="material-symbols-outlined text-[16px]">map</span>
                <span>Peta Kajian</span>
              </Link>

              {isAdmin && (
                <Link
                  href="/admin/youtube"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-semibold transition-colors"
                  title="Kelola YouTube Admin"
                >
                  <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                  <span>Admin</span>
                </Link>
              )}

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
            </div>
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="max-w-7xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 flex-1 w-full">
        {selectedVideo ? (
          /* ========================================================
             TAMPILAN WATCH MODE YOUTUBE DESKTOP (2-KOLOM 70% + 30%)
             ======================================================== */
          <DesktopYoutubeWatchView
            currentVideo={selectedVideo}
            liveChannels={liveChannels}
            upcomingStreams={upcomingStreams}
            endedStreams={endedStreams}
            isMiniPlayerActive={isMiniPlayerActive}
            onRestoreFromMiniPlayer={() => closePlayer()}
            onSelectVideo={(v) => {
              if (isLivePlayerOpen) {
                closePlayer();
              }
              setSelectedVideo(v);
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            onCloseWatchView={() => setSelectedVideo(null)}
            onOpenStudyMode={(v) => {
              handleOpenStudyNotes({
                videoId: v.videoId,
                title: v.title,
                channelName: v.channelName,
                speakerName: v.speakerName || '',
              });
            }}
            onPlayGlobalMiniPlayer={(v) => {
              playStream({
                videoId: v.videoId,
                title: v.title,
                channelName: v.channelName,
                speakerName: v.speakerName || '',
              });
            }}
            onShare={(v) => {
              if (navigator.share) {
                navigator.share({
                  title: v.title,
                  text: `Simak kajian "${v.title}" oleh ${v.speakerName || v.channelName}`,
                  url: `https://www.youtube.com/watch?v=${v.videoId}`,
                }).catch(() => {});
              } else {
                navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${v.videoId}`);
                alert('Tautan kajian berhasil disalin ke papan klip!');
              }
            }}
          />
        ) : (
          /* ========================================================
             TAMPILAN BROWSE GRID YOUTUBE DESKTOP
             ======================================================== */
          <>
            {/* 1. FILTER CHIPS BAR KHAS YOUTUBE DESKTOP */}
            <div className="flex items-center gap-2 pb-4 mb-6 border-b border-surface-container-high/60 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('live')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  activeTab === 'live'
                    ? 'bg-on-surface text-surface shadow-xs'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    liveChannels.length > 0 ? 'bg-red-600 animate-pulse' : 'bg-outline/50'
                  }`}
                />
                <span>Sedang Live</span>
                <span className="px-1.5 py-0.2 rounded-full bg-surface-container-high text-[10px] font-black">
                  {liveChannels.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('upcoming')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  activeTab === 'upcoming'
                    ? 'bg-on-surface text-surface shadow-xs'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">schedule</span>
                <span>Akan Tayang</span>
                <span className="px-1.5 py-0.2 rounded-full bg-surface-container-high text-[10px] font-black">
                  {upcomingStreams.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ended')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  activeTab === 'ended'
                    ? 'bg-on-surface text-surface shadow-xs'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">history</span>
                <span>Rekaman Selesai</span>
                <span className="px-1.5 py-0.2 rounded-full bg-surface-container-high text-[10px] font-black">
                  {endedStreams.length}
                </span>
              </button>

              <div className="h-5 w-px bg-surface-container-high mx-1 shrink-0" />

              {/* Quick Channel Chips (Filter Cepat Channel Saluran) */}
              {endedChannelsList.slice(0, 6).map(({ channel, count }) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => {
                    setActiveTab('ended');
                    setSelectedEndedChannelId(selectedEndedChannelId === channel.id ? 'all' : channel.id);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    selectedEndedChannelId === channel.id
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {channel.avatar_url ? (
                    <img src={channel.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                  ) : null}
                  <span className="truncate max-w-[120px]">{channel.channel_name}</span>
                </button>
              ))}
            </div>

            {/* TAB CONTENT 1: SEDANG LIVE */}
            {activeTab === 'live' && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                    <h3 className="font-extrabold text-base sm:text-lg text-on-surface">
                      Sedang Tayang Langsung ({filteredLiveChannels.length})
                    </h3>
                  </div>
                  <span className="text-xs text-outline hidden sm:inline">Diperbarui otomatis</span>
                </div>

                {filteredLiveChannels.length === 0 ? (
                  <div className="text-center py-16 px-4 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 max-w-md mx-auto space-y-2">
                    <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center mx-auto text-outline">
                      <span className="material-symbols-outlined text-[28px]">videocam_off</span>
                    </div>
                    <p className="font-bold text-sm text-on-surface">Tidak Ada Siaran Live Saat Ini</p>
                    <p className="text-xs text-outline leading-relaxed">
                      Belum ada saluran kajian yang sedang live streaming saat ini. Silakan periksa siaran terjadwal atau rekaman kajian.
                    </p>
                    <div className="pt-2 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('upcoming')}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold cursor-pointer"
                      >
                        Jadwal Mendatang
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('ended')}
                        className="px-3 py-1.5 rounded-xl bg-surface-container text-on-surface text-xs font-bold cursor-pointer"
                      >
                        Rekaman Selesai
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-7">
                    {filteredLiveChannels.map((channel) => (
                      <YoutubeVideoCard
                        key={channel.id}
                        videoId={channel.current_video_id!}
                        title={channel.current_video_title || `Live Streaming ${channel.channel_name}`}
                        channelName={channel.channel_name}
                        channelHandle={channel.channel_handle}
                        avatarUrl={channel.avatar_url || undefined}
                        speakerName={channel.default_speaker_name || undefined}
                        isLive={true}
                        onWatch={() =>
                          handleWatchVideo({
                            videoId: channel.current_video_id!,
                            title: channel.current_video_title || `Live Streaming ${channel.channel_name}`,
                            channelName: channel.channel_name,
                            speakerName: channel.default_speaker_name || '',
                            avatarUrl: channel.avatar_url || undefined,
                            isLive: true,
                            channelHandle: channel.channel_handle,
                            sessionId: channel.current_session_id || undefined,
                          })
                        }
                        onOpenStudyMode={() =>
                          handleOpenStudyNotes({
                            videoId: channel.current_video_id!,
                            title: channel.current_video_title || `Live Streaming ${channel.channel_name}`,
                            channelName: channel.channel_name,
                            speakerName: channel.default_speaker_name || '',
                          })
                        }
                        onShare={() => {
                          if (navigator.share) {
                            navigator.share({
                              title: channel.current_video_title || channel.channel_name,
                              url: `https://www.youtube.com/watch?v=${channel.current_video_id}`,
                            }).catch(() => {});
                          } else {
                            navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${channel.current_video_id}`);
                            alert('Tautan kajian live berhasil disalin!');
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 2: AKAN TAYANG (UPCOMING) */}
            {activeTab === 'upcoming' && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-[20px]">schedule</span>
                    <h3 className="font-extrabold text-base sm:text-lg text-on-surface">
                      Siaran Terjadwal Mendatang ({filteredUpcomingStreams.length})
                    </h3>
                  </div>
                  <span className="text-xs text-outline hidden sm:inline">Terjadwal 24–48 jam ke depan</span>
                </div>

                {filteredUpcomingStreams.length === 0 ? (
                  <div className="text-center py-16 px-4 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 max-w-md mx-auto space-y-2">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                      <span className="material-symbols-outlined text-[28px]">event_upcoming</span>
                    </div>
                    <p className="font-bold text-sm text-on-surface">Belum Ada Jadwal Mendatang</p>
                    <p className="text-xs text-outline leading-relaxed">
                      Belum ada saluran kajian yang menjadwalkan siaran dalam waktu dekat. Silakan periksa rekaman kajian selesai.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-7">
                    {filteredUpcomingStreams.map((item) => (
                      <YoutubeVideoCard
                        key={`${item.channel.id}-${item.videoId}`}
                        videoId={item.videoId}
                        title={item.title}
                        channelName={item.channelName}
                        channelHandle={item.channel.channel_handle}
                        avatarUrl={item.channel.avatar_url || undefined}
                        speakerName={item.speakerName || item.channel.default_speaker_name || undefined}
                        isLive={false}
                        timeText={formatUpcomingTime(item.scheduledStartTime)}
                        onWatch={() =>
                          handleWatchVideo({
                            videoId: item.videoId,
                            title: item.title,
                            channelName: item.channelName,
                            speakerName: item.speakerName || item.channel.default_speaker_name || '',
                            avatarUrl: item.channel.avatar_url || undefined,
                            isLive: false,
                            channelHandle: item.channel.channel_handle,
                          })
                        }
                        onOpenStudyMode={() =>
                          handleOpenStudyNotes({
                            videoId: item.videoId,
                            title: item.title,
                            channelName: item.channelName,
                            speakerName: item.speakerName || item.channel.default_speaker_name || '',
                          })
                        }
                        onShare={() => {
                          if (navigator.share) {
                            navigator.share({
                              title: item.title,
                              url: `https://www.youtube.com/watch?v=${item.videoId}`,
                            }).catch(() => {});
                          } else {
                            navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${item.videoId}`);
                            alert('Tautan kajian berhasil disalin!');
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 3: REKAMAN SELESAI (ENDED STREAMS DENGAN INFINITE SCROLL) */}
            {activeTab === 'ended' && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[20px]">history</span>
                    <h3 className="font-extrabold text-base sm:text-lg text-on-surface">
                      Rekaman Siaran Selesai ({filteredEndedStreams.length})
                    </h3>
                  </div>
                  <span className="text-xs text-outline hidden sm:inline">Dapat diputar ulang kapan saja</span>
                </div>

                {filteredEndedStreams.length === 0 ? (
                  <div className="text-center py-16 px-4 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 max-w-md mx-auto space-y-2">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto">
                      <span className="material-symbols-outlined text-[28px]">history_toggle_off</span>
                    </div>
                    <p className="font-bold text-sm text-on-surface">Tidak Ada Rekaman yang Cocok</p>
                    <p className="text-xs text-outline leading-relaxed">
                      Coba ganti filter channel atau gunakan kata kunci pencarian yang lain.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-7">
                      {visibleEndedStreams.map((item) => (
                        <YoutubeVideoCard
                          key={`${item.channel.id}-${item.videoId}`}
                          videoId={item.videoId}
                          title={item.title}
                          channelName={item.channelName}
                          channelHandle={item.channel.channel_handle}
                          avatarUrl={item.channel.avatar_url || undefined}
                          speakerName={item.speakerName || item.channel.default_speaker_name || undefined}
                          isLive={false}
                          timeText={item.endedAt ? formatEndedTime(item.endedAt) : undefined}
                          onWatch={() =>
                            handleWatchVideo({
                              videoId: item.videoId,
                              title: item.title,
                              channelName: item.channelName,
                              speakerName: item.speakerName || item.channel.default_speaker_name || '',
                              avatarUrl: item.channel.avatar_url || undefined,
                              isLive: false,
                              channelHandle: item.channel.channel_handle,
                            })
                          }
                          onOpenStudyMode={() =>
                            handleOpenStudyNotes({
                              videoId: item.videoId,
                              title: item.title,
                              channelName: item.channelName,
                              speakerName: item.speakerName || item.channel.default_speaker_name || '',
                            })
                          }
                          onShare={() => {
                            if (navigator.share) {
                              navigator.share({
                                title: item.title,
                                url: `https://www.youtube.com/watch?v=${item.videoId}`,
                              }).catch(() => {});
                            } else {
                              navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${item.videoId}`);
                              alert('Tautan kajian berhasil disalin!');
                            }
                          }}
                        />
                      ))}
                    </div>

                    {/* Infinite Scroll Sentinel & Skeleton Indicator */}
                    <div ref={loadMoreEndedRef} className="w-full py-6 flex flex-col items-center justify-center">
                      {isLoadingMoreEnded ? (
                        <div className="w-full pt-4">
                          <YoutubeGridSkeleton count={4} />
                        </div>
                      ) : hasMoreEnded ? (
                        <div className="flex items-center gap-2 text-xs text-outline py-2 font-medium">
                          <span className="w-2 h-2 rounded-full bg-outline/60 animate-ping" />
                          <span>Menggulir untuk memuat lebih banyak rekaman...</span>
                        </div>
                      ) : visibleEndedStreams.length > 0 ? (
                        <div className="pt-8 pb-4 text-center">
                          <p className="text-xs font-semibold text-outline">
                            Semua rekaman kajian telah ditampilkan ({filteredEndedStreams.length} siaran)
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>
      </div>

      {/* MODAL AJAKAN LOGIN KHUSUS MODE BELAJAR DARI CARD LIVE */}
      <StudyLoginModal
        isOpen={!!pendingStudyLogin}
        onClose={() => setPendingStudyLogin(null)}
        pendingSession={pendingStudyLogin}
      />
    </div>
  );
}

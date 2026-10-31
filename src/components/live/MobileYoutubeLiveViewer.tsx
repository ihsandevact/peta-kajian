'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type {
  YoutubeChannel,
  UpcomingStreamItem,
  EndedStreamItem,
} from '@/lib/services/youtubeTracker';
import { formatUpcomingTime, formatEndedTime } from '@/lib/services/youtubeTracker';
import { YoutubeCompactCardSkeleton } from '@/components/live/EndedStreamSkeleton';
import { ChannelVerifiedBadge } from './ChannelVerifiedBadge';

export interface PlayingVideoInfo {
  videoId: string;
  title: string;
  channelName: string;
  speakerName?: string;
  avatarUrl?: string;
  isLive?: boolean;
  timeText?: string;
  sessionId?: string;
  channelHandle?: string;
}

interface MobileYoutubeLiveViewerProps {
  liveChannels: YoutubeChannel[];
  upcomingStreams: Array<UpcomingStreamItem & { channel: YoutubeChannel; channelName: string }>;
  endedStreams: Array<EndedStreamItem & { channel: YoutubeChannel; channelName: string }>;
  onOpenStudyMode?: (stream: {
    videoId: string;
    title: string;
    channelName?: string;
    speakerName?: string;
    sessionId?: string;
  }) => void;
  onPlayGlobalMiniPlayer?: (stream: {
    videoId: string;
    title: string;
    channelName: string;
    speakerName?: string;
  }) => void;
  onSelectVideo?: (stream: PlayingVideoInfo) => void;
  initialVideo?: PlayingVideoInfo | null;
}

export default function MobileYoutubeLiveViewer({
  liveChannels,
  upcomingStreams,
  endedStreams,
  onOpenStudyMode,
  onPlayGlobalMiniPlayer,
  onSelectVideo,
  initialVideo,
}: MobileYoutubeLiveViewerProps) {
  // Video yang saat ini aktif diputar di Top Player (Prioritas: Live -> Rekaman Terbaru)
  const [activeVideo, setActiveVideo] = useState<PlayingVideoInfo | null>(() => {
    if (initialVideo) return initialVideo;
    const firstLive = liveChannels.find((c) => Boolean(c.current_video_id));
    if (firstLive && firstLive.current_video_id) {
      return {
        videoId: firstLive.current_video_id,
        title: firstLive.current_video_title || `Live Kajian: ${firstLive.channel_name}`,
        channelName: firstLive.channel_name,
        speakerName: firstLive.default_speaker_name || '',
        avatarUrl: firstLive.avatar_url || undefined,
        isLive: true,
        sessionId: firstLive.current_session_id || undefined,
        channelHandle: firstLive.channel_handle,
      };
    }
    if (endedStreams.length > 0) {
      const e = endedStreams[0];
      return {
        videoId: e.videoId,
        title: e.title,
        channelName: e.channelName,
        speakerName: e.speakerName || e.channel.default_speaker_name || '',
        avatarUrl: e.channel.avatar_url || undefined,
        isLive: false,
        timeText: e.endedAt ? formatEndedTime(e.endedAt) : undefined,
        channelHandle: e.channel.channel_handle || undefined,
      };
    }
    return null;
  });

  // State tampilan pemutar: 'expanded' (nempel di atas 16:9) vs 'minimized' (bar tipis di atas bottom nav)
  const [isPlayerMinimized, setIsPlayerMinimized] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [playerError, setPlayerError] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'live' | 'upcoming' | 'ended'>(() => {
    const hasLive = liveChannels.some((c) => Boolean(c.current_video_id));
    return hasLive ? 'live' : 'ended';
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('all');

  // Sinkronisasi otomatis saat data siaran selesai dimuat (jika tidak ada live -> putar rekaman terbaru)
  useEffect(() => {
    if (activeVideo) return;
    const firstLive = liveChannels.find((c) => Boolean(c.current_video_id));
    if (firstLive && firstLive.current_video_id) {
      setActiveVideo({
        videoId: firstLive.current_video_id,
        title: firstLive.current_video_title || `Live Kajian: ${firstLive.channel_name}`,
        channelName: firstLive.channel_name,
        speakerName: firstLive.default_speaker_name || '',
        avatarUrl: firstLive.avatar_url || undefined,
        isLive: true,
        sessionId: firstLive.current_session_id || undefined,
        channelHandle: firstLive.channel_handle || undefined,
      });
      setActiveTab('live');
    } else if (endedStreams.length > 0) {
      const e = endedStreams[0];
      setActiveVideo({
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
    }
  }, [liveChannels, endedStreams, activeVideo]);

  // Paginasi & Infinite Scroll untuk daftar rekaman
  const [visibleEndedCount, setVisibleEndedCount] = useState<number>(15);
  const [isLoadingMoreEnded, setIsLoadingMoreEnded] = useState<boolean>(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reset error state & mute saat video berganti
  useEffect(() => {
    setPlayerError(false);
    setIsMuted(true);
  }, [activeVideo?.videoId]);

  // Handler interaksi iframe YouTube
  const sendIframeCommand = useCallback((func: string, args: any[] = []) => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      }
    } catch {}
  }, []);

  const handleUnmute = useCallback(() => {
    sendIframeCommand('unMute');
    sendIframeCommand('setVolume', [100]);
    sendIframeCommand('playVideo');
    setIsMuted(false);
  }, [sendIframeCommand]);

  // Pantau pesan event dari YouTube iframe (ready, muted, error)
  useEffect(() => {
    if (!activeVideo) return;

    const handleMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        const isErrorEvent =
          data?.event === 'onError' ||
          typeof data?.info?.errorCode !== 'undefined' ||
          (data?.event === 'infoDelivery' && typeof data?.info?.errorCode !== 'undefined');

        if (isErrorEvent) {
          const rawCode = data?.data ?? data?.info?.errorCode ?? data?.info;
          const errCode = Number(rawCode);
          if (errCode === 100 || errCode === 101 || errCode === 150 || errCode === 2) {
            setPlayerError(true);
          }
        }

        if (data?.event === 'onReady') {
          sendIframeCommand('playVideo');
        }
        if (typeof data?.info?.muted === 'boolean') {
          setIsMuted(data.info.muted);
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeVideo, sendIframeCommand]);

  // Listener untuk restore video dari floating mini player saat tombol maximize diklik di halaman live
  useEffect(() => {
    const handleRestoreEvent = (e: Event) => {
      const customEvt = e as CustomEvent<{
        videoId: string;
        title: string;
        channelName: string;
        speakerName?: string;
      }>;
      if (customEvt.detail) {
        setActiveVideo({
          videoId: customEvt.detail.videoId,
          title: customEvt.detail.title,
          channelName: customEvt.detail.channelName,
          speakerName: customEvt.detail.speakerName,
        });
        setIsPlayerMinimized(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    window.addEventListener('peta-kajian:restore-live-video', handleRestoreEvent);
    return () => {
      window.removeEventListener('peta-kajian:restore-live-video', handleRestoreEvent);
    };
  }, []);

  // Filter video berdasarkan pencarian lokal & filter saluran
  const q = searchQuery.toLowerCase().trim();

  const filteredLive = useMemo(() => {
    return liveChannels.filter((c) => {
      if (selectedChannelId !== 'all' && c.id !== selectedChannelId) return false;
      if (!q) return true;
      return (
        c.channel_name.toLowerCase().includes(q) ||
        c.channel_handle.toLowerCase().includes(q) ||
        (c.default_speaker_name && c.default_speaker_name.toLowerCase().includes(q)) ||
        (c.current_video_title && c.current_video_title.toLowerCase().includes(q))
      );
    });
  }, [liveChannels, q, selectedChannelId]);

  const filteredUpcoming = useMemo(() => {
    return upcomingStreams.filter((item) => {
      if (selectedChannelId !== 'all' && item.channel.id !== selectedChannelId) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.channelName.toLowerCase().includes(q) ||
        (item.speakerName && item.speakerName.toLowerCase().includes(q))
      );
    });
  }, [upcomingStreams, q, selectedChannelId]);

  const filteredEnded = useMemo(() => {
    return endedStreams.filter((item) => {
      if (selectedChannelId !== 'all' && item.channel.id !== selectedChannelId) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.channelName.toLowerCase().includes(q) ||
        (item.speakerName && item.speakerName.toLowerCase().includes(q))
      );
    });
  }, [endedStreams, q, selectedChannelId]);

  // Daftar channel aktif untuk filter chips
  const activeChannelsList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatarUrl?: string; count: number }>();
    endedStreams.forEach((s) => {
      if (!map.has(s.channel.id)) {
        map.set(s.channel.id, {
          id: s.channel.id,
          name: s.channel.channel_name,
          avatarUrl: s.channel.avatar_url || undefined,
          count: 0,
        });
      }
      map.get(s.channel.id)!.count++;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [endedStreams]);

  // Reset infinite scroll count saat pencarian atau filter channel berubah
  useEffect(() => {
    setVisibleEndedCount(15);
  }, [q, selectedChannelId, activeTab]);

  // Sliced items untuk infinite scroll
  const visibleEndedStreams = useMemo(() => {
    return filteredEnded.slice(0, visibleEndedCount);
  }, [filteredEnded, visibleEndedCount]);

  const hasMoreEnded = visibleEndedCount < filteredEnded.length;

  const handleLoadMoreEnded = useCallback(() => {
    if (isLoadingMoreEnded || !hasMoreEnded) return;
    setIsLoadingMoreEnded(true);
    setTimeout(() => {
      setVisibleEndedCount((prev) => prev + 15);
      setIsLoadingMoreEnded(false);
    }, 300);
  }, [isLoadingMoreEnded, hasMoreEnded]);

  // IntersectionObserver untuk Infinite Scroll di Mobile
  useEffect(() => {
    if (activeTab !== 'ended' || !hasMoreEnded) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMoreEnded();
        }
      },
      { rootMargin: '250px' }
    );

    const el = loadMoreSentinelRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [activeTab, hasMoreEnded, handleLoadMoreEnded]);

  // Handler pilih video dari feed bawah -> langsung putar di atas
  const handleSelectVideo = (video: PlayingVideoInfo) => {
    setActiveVideo(video);
    setIsPlayerMinimized(false);
    if (onSelectVideo) {
      onSelectVideo(video);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handler native share
  const handleShare = async () => {
    if (!activeVideo) return;
    const shareUrl = `https://www.youtube.com/watch?v=${activeVideo.videoId}`;
    const shareTitle = `${activeVideo.title} — ${activeVideo.channelName}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `Simak siaran kajian: ${shareTitle}`,
          url: shareUrl,
        });
      } catch {}
    } else {
      navigator.clipboard?.writeText(shareUrl);
      alert('Tautan kajian berhasil disalin!');
    }
  };

  return (
    <div className="w-full flex flex-col font-geist bg-surface text-on-surface">
      {/* ====================================================================== */}
      {/* 1. STICKY TOP VIDEO PLAYER (16:9 ALA YOUTUBE MOBILE)                  */}
      {/* ====================================================================== */}
      {activeVideo && !isPlayerMinimized && (
        <div className="sticky top-0 z-30 w-full bg-black shadow-lg">
          {/* 16:9 Video Box */}
          <div className="relative aspect-video w-full bg-neutral-950 overflow-hidden">
            {playerError ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-b from-neutral-900 to-black text-center text-white space-y-2">
                <span className="material-symbols-outlined text-[24px] text-amber-400">lock</span>
                <p className="text-xs font-bold">Siaran Tidak Dapat Diputar di Aplikasi</p>
                <p className="text-[11px] text-white/70 max-w-xs">
                  Saluran membatasi pemutaran internal atau video telah disetel privat.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={`https://www.youtube.com/watch?v=${activeVideo.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    <span>Buka di YouTube</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setActiveVideo(null)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-medium cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                src={`https://www.youtube.com/embed/${activeVideo.videoId}?autoplay=1&mute=1&enablejsapi=1&playsinline=1&rel=0`}
                title={activeVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-0"
              />
            )}

            {/* Quick Header Overlay Button (Minimize / Floating Mini Player) */}
            <div className="absolute top-2 left-2 pointer-events-none z-20">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onPlayGlobalMiniPlayer && activeVideo) {
                    onPlayGlobalMiniPlayer({
                      videoId: activeVideo.videoId,
                      title: activeVideo.title,
                      channelName: activeVideo.channelName,
                      speakerName: activeVideo.speakerName,
                    });
                    setActiveVideo(null);
                  } else {
                    setIsPlayerMinimized(true);
                  }
                }}
                className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center pointer-events-auto hover:bg-black/80 transition-all shadow-md active:scale-95 cursor-pointer"
                title="Putar di Floating Mini Player"
                aria-label="Kecilkan ke Mini Player"
              >
                <span className="material-symbols-outlined text-[20px]">expand_more</span>
              </button>
            </div>

            {/* Tap-to-Unmute Overlay Button */}
            {isMuted && !playerError && (
              <div
                onClick={handleUnmute}
                className="absolute bottom-3 left-3 z-20 cursor-pointer select-none animate-in fade-in duration-200"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnmute();
                  }}
                  className="px-3 py-1.5 rounded-full bg-black/80 hover:bg-black/95 backdrop-blur-md text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-xl border border-white/20 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-amber-400 animate-pulse">volume_off</span>
                  <span>Ketuk untuk Suara</span>
                </button>
              </div>
            )}
          </div>

          {/* Video Metadata & Action Bar Khas YouTube Mobile */}
          <div className="bg-surface-container-lowest p-3 border-b border-surface-container-high/60 space-y-2">
            <div>
              {/* Judul Kajian */}
              <h1 className="text-xs sm:text-sm font-extrabold text-on-surface line-clamp-2 leading-snug">
                {activeVideo.title}
              </h1>

              {/* Status Waktu & Saluran */}
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-outline font-medium">
                {activeVideo.isLive ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-500/10 px-1.5 py-0.2 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                    LIVE
                  </span>
                ) : activeVideo.timeText ? (
                  <span>{activeVideo.timeText}</span>
                ) : (
                  <span>Siaran Kajian</span>
                )}
                <span>•</span>
                <span className="truncate">{activeVideo.channelName}</span>
              </div>
            </div>

            {/* Baris Saluran & Avatar */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-surface-container-high/40">
              <div className="flex items-center gap-2 min-w-0">
                {activeVideo.channelHandle ? (
                  <a
                    href={`https://www.youtube.com/${activeVideo.channelHandle.startsWith('@') ? activeVideo.channelHandle : `@${activeVideo.channelHandle}`}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full overflow-hidden bg-surface-container shrink-0 border border-surface-container-high/60 cursor-pointer active:scale-95 transition-transform"
                    title={`Kunjungi saluran ${activeVideo.channelName} di YouTube`}
                  >
                    {activeVideo.avatarUrl ? (
                      <img src={activeVideo.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-red-600/10 text-red-600 font-bold flex items-center justify-center text-xs">
                        {activeVideo.channelName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </a>
                ) : (
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container shrink-0 border border-surface-container-high/60">
                    {activeVideo.avatarUrl ? (
                      <img src={activeVideo.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-red-600/10 text-red-600 font-bold flex items-center justify-center text-xs">
                        {activeVideo.channelName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    {activeVideo.channelHandle ? (
                      <a
                        href={`https://www.youtube.com/${activeVideo.channelHandle.startsWith('@') ? activeVideo.channelHandle : `@${activeVideo.channelHandle}`}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-on-surface hover:text-primary active:underline truncate transition-colors cursor-pointer"
                        title={`Kunjungi saluran ${activeVideo.channelName} di YouTube`}
                      >
                        {activeVideo.channelName}
                      </a>
                    ) : (
                      <span className="text-xs font-bold text-on-surface truncate">
                        {activeVideo.channelName}
                      </span>
                    )}
                    <ChannelVerifiedBadge size="sm" />
                  </div>
                  {activeVideo.speakerName && (
                    <p className="text-[10px] text-outline truncate">
                      Pemateri: {activeVideo.speakerName}
                    </p>
                  )}
                </div>
              </div>

              {/* Tombol Catat Faidah / Mode Belajar (Icon-Only di Baris Saluran) */}
              {onOpenStudyMode && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenStudyMode({
                      videoId: activeVideo.videoId,
                      title: activeVideo.title,
                      channelName: activeVideo.channelName,
                      speakerName: activeVideo.speakerName,
                      sessionId: activeVideo.sessionId,
                    })
                  }
                  className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs active:scale-95 transition-all cursor-pointer"
                  title="Catat Faidah Kajian (Mode Belajar)"
                  aria-label="Catat Faidah Kajian"
                >
                  <span className="material-symbols-outlined text-[19px]">edit_note</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* 2. FLOATING MINI-PLAYER BAR (DI ATAS BOTTOM NAVIGATION SAAT MINIMIZED) */}
      {/* ====================================================================== */}
      {activeVideo && isPlayerMinimized && (
        <div
          onClick={() => {
            setIsPlayerMinimized(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="fixed bottom-[64px] inset-x-2 z-40 h-14 bg-surface-container-lowest/98 backdrop-blur-md rounded-2xl border border-surface-container-high shadow-2xl flex items-center justify-between p-1.5 gap-2 cursor-pointer animate-in slide-in-from-bottom-2 duration-200"
          title="Ketuk untuk memperbesar pemutar video"
        >
          {/* Mini Thumbnail */}
          <div className="relative w-16 h-11 rounded-xl overflow-hidden bg-black shrink-0">
            <img
              src={`https://i.ytimg.com/vi/${activeVideo.videoId}/hqdefault.jpg`}
              alt=""
              className="w-full h-full object-cover"
            />
            {activeVideo.isLive && (
              <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-red-600 text-white text-[8px] font-bold rounded">
                LIVE
              </span>
            )}
          </div>

          {/* Mini Info */}
          <div className="flex-1 min-w-0 pr-1">
            <p className="text-xs font-bold text-on-surface truncate leading-tight">
              {activeVideo.title}
            </p>
            <p className="text-[10px] text-on-surface-variant truncate mt-0.5">
              {activeVideo.channelName}
            </p>
          </div>

          {/* Actions: Restore & Close */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setIsPlayerMinimized(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface transition-colors cursor-pointer"
              title="Perbesar"
              aria-label="Perbesar Video"
            >
              <span className="material-symbols-outlined text-[20px]">expand_less</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveVideo(null)}
              className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
              title="Tutup"
              aria-label="Tutup Video"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* 3. MULTITASKING SCROLLABLE FEED (DAFTAR KAJIAN LAIN DI BAWAH PLAYER)  */}
      {/* ====================================================================== */}
      <div className="flex-1 flex flex-col p-3.5 space-y-3 pb-[100px]">
        {/* Search Bar Mobile */}
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Cari kajian, pemateri, atau saluran..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs rounded-xl pl-9 pr-8 py-2 border border-surface-container-high/80 focus:bg-surface-container-lowest focus:outline-none focus:border-primary transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-outline/20 hover:bg-outline/30 flex items-center justify-center text-outline transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[13px]">close</span>
            </button>
          )}
        </div>

        {/* Filter Chips Bar (3 Kategori: Live, Mendatang, Rekaman + Quick Channel Pills) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 px-0.5">
          {/* Chip Sedang Live */}
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            className={`h-8 px-3.5 rounded-full text-xs transition-all shrink-0 cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              activeTab === 'live'
                ? 'bg-red-600 text-white font-bold shadow-2xs'
                : 'bg-surface-container-high/60 hover:bg-surface-container-high text-on-surface-variant font-medium border border-outline-variant/20'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeTab === 'live' ? 'bg-white animate-pulse' : 'bg-red-500'}`} />
            <span>Live ({liveChannels.length})</span>
          </button>

          {/* Chip Mendatang */}
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`h-8 px-3.5 rounded-full text-xs transition-all shrink-0 cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              activeTab === 'upcoming'
                ? 'bg-on-surface text-surface font-bold shadow-2xs'
                : 'bg-surface-container-high/60 hover:bg-surface-container-high text-on-surface-variant font-medium border border-outline-variant/20'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">schedule</span>
            <span>Mendatang ({upcomingStreams.length})</span>
          </button>

          {/* Chip Rekaman */}
          <button
            type="button"
            onClick={() => setActiveTab('ended')}
            className={`h-8 px-3.5 rounded-full text-xs transition-all shrink-0 cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              activeTab === 'ended'
                ? 'bg-on-surface text-surface font-bold shadow-2xs'
                : 'bg-surface-container-high/60 hover:bg-surface-container-high text-on-surface-variant font-medium border border-outline-variant/20'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">history</span>
            <span>Rekaman ({endedStreams.length})</span>
          </button>

          <div className="h-5 w-px bg-surface-container-high shrink-0 mx-0.5" />

          {/* Filter Cepat Tiap Saluran YouTube */}
          {activeChannelsList.slice(0, 8).map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => {
                setSelectedChannelId(selectedChannelId === ch.id ? 'all' : ch.id);
              }}
              className={`h-8 inline-flex items-center gap-1.5 px-3 rounded-full text-xs transition-all shrink-0 cursor-pointer active:scale-95 ${
                selectedChannelId === ch.id
                  ? 'bg-red-600 text-white font-bold shadow-2xs'
                  : 'bg-surface-container-high/60 hover:bg-surface-container-high text-on-surface-variant font-medium border border-outline-variant/20'
              }`}
            >
              {ch.avatarUrl ? (
                <img src={ch.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
              ) : null}
              <span className="truncate max-w-[130px]">{ch.name}</span>
            </button>
          ))}
        </div>

        {/* List Items Sesuai Tab Aktif */}
        <div className="space-y-2.5 pt-1">
          {/* TAB 1: SEDANG LIVE */}
          {activeTab === 'live' && (
            filteredLive.length === 0 ? (
              <div className="p-8 text-center text-outline text-xs space-y-1.5 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                <span className="material-symbols-outlined text-[30px] text-red-500">sensors_off</span>
                <p className="font-semibold text-on-surface">Belum ada siaran langsung saat ini</p>
                <p className="text-[11px] text-on-surface-variant">Silakan cek tab Jadwal Mendatang atau Rekaman Selesai.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 px-0.5">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  <span>Sedang Live Sekarang ({filteredLive.length})</span>
                </div>

                {filteredLive.map((channel) => {
                  const isPlaying = activeVideo?.videoId === channel.current_video_id;
                  const videoId = channel.current_video_id;
                  if (!videoId) return null;

                  const videoInfo: PlayingVideoInfo = {
                    videoId,
                    title: channel.current_video_title || `Live Kajian: ${channel.channel_name}`,
                    channelName: channel.channel_name,
                    speakerName: channel.default_speaker_name || '',
                    avatarUrl: channel.avatar_url || undefined,
                    isLive: true,
                    sessionId: channel.current_session_id || undefined,
                    channelHandle: channel.channel_handle,
                  };

                  return (
                    <div
                      key={channel.id}
                      onClick={() => handleSelectVideo(videoInfo)}
                      className={`flex items-start gap-2.5 p-2 rounded-2xl transition-all cursor-pointer border ${
                        isPlaying
                          ? 'bg-emerald-500/10 border-emerald-500/50 shadow-xs'
                          : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/30'
                      }`}
                    >
                      {/* Thumbnail 16:9 Compact */}
                      <div className="relative w-32 sm:w-36 aspect-video rounded-xl overflow-hidden bg-black shrink-0 shadow-2xs">
                        <img
                          src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.2 bg-red-600 text-white text-[9px] font-black rounded flex items-center gap-0.5">
                          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                          LIVE
                        </span>
                        {isPlaying && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-[20px] text-emerald-400 animate-pulse">
                              equalizer
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Meta Detail */}
                      <div className="flex-1 min-w-0 py-0.5">
                        <h4 className="text-xs font-bold text-on-surface line-clamp-2 leading-snug">
                          {videoInfo.title}
                        </h4>
                        <p className="text-[11px] font-semibold text-primary truncate mt-1 flex items-center gap-1">
                          <span>{videoInfo.channelName}</span>
                          <ChannelVerifiedBadge size="xs" />
                        </p>
                        {videoInfo.speakerName && (
                          <p className="text-[10px] text-outline truncate mt-0.5">
                            {videoInfo.speakerName}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* TAB 2: JADWAL MENDATANG */}
          {activeTab === 'upcoming' && (
            filteredUpcoming.length === 0 ? (
              <div className="p-8 text-center text-outline text-xs space-y-1.5 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                <span className="material-symbols-outlined text-[30px] text-amber-500">event_busy</span>
                <p className="font-semibold text-on-surface">Belum ada siaran mendatang</p>
                <p className="text-[11px] text-on-surface-variant">Jadwal siaran baru akan otomatis muncul saat saluran menjadwalkan Premiere.</p>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface px-0.5">
                  <span className="material-symbols-outlined text-[16px] text-amber-600">schedule</span>
                  <span>Jadwal Mendatang ({filteredUpcoming.length})</span>
                </div>

                {filteredUpcoming.map((item) => {
                  const timeLabel = formatUpcomingTime(item.scheduledStartTime);

                  return (
                    <div
                      key={item.videoId}
                      className="flex items-start gap-2.5 p-2 rounded-2xl bg-surface-container-low border border-outline-variant/30"
                    >
                      <div className="relative w-32 sm:w-36 aspect-video rounded-xl overflow-hidden bg-black shrink-0 shadow-2xs">
                        <img
                          src={item.posterUrl || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.2 bg-black/80 backdrop-blur-xs text-white text-[9px] font-bold rounded">
                          Mendatang
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 py-0.5">
                        <span className="inline-block px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-bold mb-0.5">
                          {timeLabel}
                        </span>
                        <h4 className="text-xs font-bold text-on-surface line-clamp-2 leading-snug">
                          {item.title}
                        </h4>
                        <p className="text-[11px] font-semibold text-primary truncate mt-1">
                          {item.channelName}
                        </p>
                        <a
                          href={item.streamUrl || `https://www.youtube.com/watch?v=${item.videoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline mt-1"
                        >
                          <span>Pasang Pengingat di YouTube</span>
                          <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* TAB 3: REKAMAN SELESAI (DENGAN INFINITE SCROLL) */}
          {activeTab === 'ended' && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface px-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-blue-600 dark:text-blue-400">history</span>
                  <span>Rekaman Kajian ({filteredEnded.length})</span>
                </div>
                {hasMoreEnded && (
                  <span className="text-[10px] text-outline font-normal">
                    Menampilkan {visibleEndedStreams.length} dari {filteredEnded.length}
                  </span>
                )}
              </div>

              {filteredEnded.length === 0 ? (
                <div className="p-8 text-center text-outline text-xs space-y-1 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                  <span className="material-symbols-outlined text-[28px]">history</span>
                  <p className="font-semibold text-on-surface">Tidak ada rekaman ditemukan</p>
                  <p className="text-[11px]">Coba kata kunci lain atau pilih saluran yang berbeda.</p>
                </div>
              ) : (
                <>
                  {visibleEndedStreams.map((item) => {
                    const isPlaying = activeVideo?.videoId === item.videoId;
                    const timeLabel = item.endedAt ? formatEndedTime(item.endedAt) : undefined;

                    const videoInfo: PlayingVideoInfo = {
                      videoId: item.videoId,
                      title: item.title,
                      channelName: item.channelName,
                      speakerName: item.speakerName,
                      avatarUrl: item.channel.avatar_url || undefined,
                      isLive: false,
                      timeText: timeLabel,
                      channelHandle: item.channel.channel_handle,
                    };

                    return (
                      <div
                        key={item.videoId}
                        onClick={() => handleSelectVideo(videoInfo)}
                        className={`flex items-start gap-2.5 p-2 rounded-2xl transition-all cursor-pointer border ${
                          isPlaying
                            ? 'bg-emerald-500/10 border-emerald-500/50 shadow-xs'
                            : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/30'
                        }`}
                      >
                        <div className="relative w-32 sm:w-36 aspect-video rounded-xl overflow-hidden bg-black shrink-0 shadow-2xs">
                          <img
                            src={item.posterUrl || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {timeLabel && (
                            <span className="absolute bottom-1 right-1 px-1.5 py-0.2 bg-black/80 backdrop-blur-xs text-white text-[9px] font-medium rounded">
                              {timeLabel}
                            </span>
                          )}
                          {isPlaying && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                              <span className="material-symbols-outlined text-[20px] text-emerald-400 animate-pulse">
                                equalizer
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 py-0.5">
                          <h4 className="text-xs font-bold text-on-surface line-clamp-2 leading-snug">
                            {item.title}
                          </h4>
                          <p className="text-[11px] font-semibold text-primary truncate mt-1 flex items-center gap-1">
                            <span>{item.channelName}</span>
                            <ChannelVerifiedBadge size="xs" />
                          </p>
                          {item.speakerName && (
                            <p className="text-[10px] text-outline truncate mt-0.5">
                              {item.speakerName}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Infinite Scroll Sentinel & Skeleton Loader di Mobile */}
                  <div ref={loadMoreSentinelRef} className="w-full py-3 flex flex-col items-center justify-center">
                    {isLoadingMoreEnded ? (
                      <div className="w-full space-y-2 pt-1">
                        <YoutubeCompactCardSkeleton />
                        <YoutubeCompactCardSkeleton />
                      </div>
                    ) : hasMoreEnded ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-outline py-2 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-outline animate-ping" />
                        <span>Menggulir untuk memuat lebih banyak rekaman...</span>
                      </div>
                    ) : visibleEndedStreams.length > 0 ? (
                      <div className="pt-4 pb-2 text-center">
                        <p className="text-[11px] text-outline font-medium">
                          Seluruh {filteredEnded.length} rekaman kajian telah ditampilkan
                        </p>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

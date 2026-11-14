'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type {
  YoutubeChannel,
  UpcomingStreamItem,
  EndedStreamItem,
} from '@/lib/services/youtubeTracker';
import {
  formatUpcomingTime,
  formatEndedTime,
  pinActiveVideoToTop,
} from '@/lib/services/youtubeTracker';
import { ChannelVerifiedBadge } from './ChannelVerifiedBadge';
import {
  sendPlayVideo,
  sendPauseVideo,
  sendStopVideo,
  sendMute,
  sendUnmute as sendYouTubeUnmute,
  sendListening,
} from '@/lib/domain/youtubeIframe';

export interface WatchVideoData {
  videoId: string;
  title: string;
  channelName: string;
  speakerName?: string;
  avatarUrl?: string;
  isLive?: boolean;
  timeText?: string;
  channelHandle?: string;
  sessionId?: string;
}

interface DesktopYoutubeWatchViewProps {
  currentVideo: WatchVideoData;
  liveChannels: YoutubeChannel[];
  upcomingStreams: Array<UpcomingStreamItem & { channel: YoutubeChannel; channelName: string }>;
  endedStreams: Array<EndedStreamItem & { channel: YoutubeChannel; channelName: string }>;
  onSelectVideo: (video: WatchVideoData) => void;
  onCloseWatchView: () => void;
  onOpenStudyMode?: (video: WatchVideoData) => void;
  onPlayGlobalMiniPlayer?: (video: WatchVideoData) => void;
  onShare?: (video: WatchVideoData) => void;
  isMiniPlayerActive?: boolean;
  onRestoreFromMiniPlayer?: () => void;
  searchQuery?: string;
  onClearSearch?: () => void;
}

export default function DesktopYoutubeWatchView({
  currentVideo,
  liveChannels,
  upcomingStreams,
  endedStreams,
  onSelectVideo,
  onCloseWatchView,
  onOpenStudyMode,
  onPlayGlobalMiniPlayer,
  onShare,
  isMiniPlayerActive = false,
  onRestoreFromMiniPlayer,
  searchQuery = '',
  onClearSearch,
}: DesktopYoutubeWatchViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [playerError, setPlayerError] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState<'live' | 'upcoming' | 'ended'>(() => {
    if (liveChannels.length > 0) return 'live';
    if (endedStreams.length > 0) return 'ended';
    return 'upcoming';
  });
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  const [origin, setOrigin] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  // Reset error & mute state saat berganti video
  useEffect(() => {
    setPlayerError(false);
    setIsMuted(true);
  }, [currentVideo.videoId]);

  // Cleanup iframe audio saat unmount
  useEffect(() => {
    return () => {
      try {
        if (iframeRef.current) {
          sendMute(iframeRef.current);
          sendStopVideo(iframeRef.current);
        }
      } catch {}
    };
  }, []);

  // Helper picu playVideo & unMute
  const sendPlay = useCallback(() => {
    try {
      if (iframeRef.current) {
        sendPlayVideo(iframeRef.current);
      }
    } catch {}
  }, []);

  const sendUnmute = useCallback(() => {
    try {
      if (iframeRef.current) {
        sendYouTubeUnmute(iframeRef.current, 100);
        setIsMuted(false);
      }
    } catch {}
  }, []);

  // Format list video rekomendasi di sidebar kanan
  const relatedVideos = useMemo(() => {
    const list: WatchVideoData[] = [];

    // 1. Sedang Live
    if (sidebarFilter === 'live') {
      liveChannels.forEach((c) => {
        if (c.current_video_id) {
          list.push({
            videoId: c.current_video_id,
            title: c.current_video_title || `Live Streaming ${c.channel_name}`,
            channelName: c.channel_name,
            speakerName: c.default_speaker_name || '',
            avatarUrl: c.avatar_url || undefined,
            isLive: true,
            channelHandle: c.channel_handle,
            sessionId: c.current_session_id || undefined,
          });
        }
      });
    }

    // 2. Terjadwal Mendatang
    if (sidebarFilter === 'upcoming') {
      upcomingStreams.forEach((u) => {
        if (u.videoId) {
          list.push({
            videoId: u.videoId,
            title: u.title,
            channelName: u.channelName,
            speakerName: u.speakerName || u.channel.default_speaker_name || '',
            avatarUrl: u.channel.avatar_url || undefined,
            isLive: false,
            timeText: u.scheduledStartTime ? formatUpcomingTime(u.scheduledStartTime) : 'Segera',
            channelHandle: u.channel.channel_handle,
          });
        }
      });
    }

    // 3. Rekaman Selesai
    if (sidebarFilter === 'ended') {
      endedStreams.forEach((e) => {
        if (e.videoId) {
          list.push({
            videoId: e.videoId,
            title: e.title,
            channelName: e.channelName,
            speakerName: e.speakerName || e.channel.default_speaker_name || '',
            avatarUrl: e.channel.avatar_url || undefined,
            isLive: false,
            timeText: e.endedAt ? formatEndedTime(e.endedAt) : undefined,
            channelHandle: e.channel.channel_handle,
          });
        }
      });
    }

    // Filter berdasarkan kata kunci pencarian (searchQuery)
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? list.filter(
          (v) =>
            v.title.toLowerCase().includes(q) ||
            v.channelName.toLowerCase().includes(q) ||
            (v.speakerName && v.speakerName.toLowerCase().includes(q))
        )
      : list;

    if (!currentVideo?.videoId) return filtered;
    return pinActiveVideoToTop(filtered, (v) => v.videoId === currentVideo.videoId);
  }, [liveChannels, upcomingStreams, endedStreams, sidebarFilter, currentVideo.videoId, searchQuery]);

  return (
    <div className="w-full font-sans space-y-4">
      {/* TOP BAR MODE TONTON: Switcher ke Mode Katalog Grid & Status Siaran */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-outline-variant/20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCloseWatchView}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/30 text-xs font-bold text-on-surface hover:text-[#126947] transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Buka tampilan katalog grid semua siaran"
          >
            <span className="material-symbols-outlined text-[16px]">grid_view</span>
            <span>Jelajahi Katalog Grid</span>
          </button>

          {currentVideo.isLive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-extrabold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>Sedang Tayang Langsung</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300 text-[11px] font-bold">
              <span className="material-symbols-outlined text-[14px]">play_circle</span>
              <span>Mode Tonton Kajian</span>
            </span>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[12px] text-on-surface-variant font-medium">
          <span>
            <strong className="text-on-surface font-bold">{liveChannels.length}</strong> Live
          </span>
          <span>·</span>
          <span>
            <strong className="text-on-surface font-bold">{upcomingStreams.length}</strong> Terjadwal
          </span>
          <span>·</span>
          <span>
            <strong className="text-on-surface font-bold">{endedStreams.length}</strong> Rekaman
          </span>
        </div>
      </div>

      {/* DUA KOLOM UTAMA KHAS HOMEPAGE / YOUTUBE DESKTOP */}
      <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-7 w-full">
        {/* ========================================================
            KOLOM KIRI (68%): PLAYER BESAR + DETAIL CARD + ACTION BAR
           ======================================================== */}
        <div className="w-full lg:w-[66%] xl:w-[69%] flex flex-col">
          {/* 1. PLAYER 16:9 BESAR */}
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg border border-outline-variant/25">
            {isMiniPlayerActive ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-950 text-center select-none space-y-3 relative overflow-hidden">
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-15 filter blur-lg scale-110 pointer-events-none"
                  style={{
                    backgroundImage: `url(https://i.ytimg.com/vi/${currentVideo.videoId}/hqdefault.jpg)`,
                  }}
                />

                <div className="relative z-10 w-14 h-14 rounded-2xl bg-red-600/15 text-red-500 flex items-center justify-center border border-red-500/25 shadow-lg animate-pulse">
                  <span className="material-symbols-outlined text-[30px]">
                    picture_in_picture_alt
                  </span>
                </div>

                <div className="relative z-10 space-y-1 max-w-md">
                  <p className="text-base font-extrabold text-white">
                    Sedang Diputar di Mini Player Pojok Layar
                  </p>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    Video utama dijeda agar audio tidak bertumpuk. Anda dapat menjelajahi halaman
                    lain sambil tetap menyimak kajian.
                  </p>
                </div>

                {onRestoreFromMiniPlayer && (
                  <div className="relative z-10 pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          window.dispatchEvent(new CustomEvent('peta-kajian:stop-mini-player'));
                        } catch {}
                        onRestoreFromMiniPlayer();
                      }}
                      className="px-4 py-2 rounded-full bg-[#126947] hover:bg-[#0e5237] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">fullscreen</span>
                      <span>Kembalikan Pemutar ke Sini</span>
                    </button>
                  </div>
                )}
              </div>
            ) : playerError ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-neutral-900 to-neutral-950 text-center select-none space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/25">
                  <span className="material-symbols-outlined text-[24px]">lock</span>
                </div>
                <div className="space-y-1 max-w-md">
                  <p className="text-base font-extrabold text-white">
                    Rekaman Diatur Privat oleh Saluran
                  </p>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    Saluran YouTube terkait memprivat siaran ini untuk proses editing atau rilis
                    rekaman resmi berkualitas tinggi.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <a
                    href={`https://www.youtube.com/watch?v=${currentVideo.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                    <span>Buka di YouTube</span>
                  </a>
                </div>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                src={`https://www.youtube.com/embed/${currentVideo.videoId}?autoplay=1&mute=1&controls=1&enablejsapi=1&playsinline=1&rel=0${origin ? `&origin=${encodeURIComponent(origin)}` : ''}`}
                title={currentVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="w-full h-full border-0"
                onLoad={() => {
                  try {
                    if (iframeRef.current) {
                      sendListening(iframeRef.current);
                      setTimeout(() => {
                        sendPlay();
                        sendUnmute();
                      }, 400);
                    }
                  } catch {}
                }}
              />
            )}

            {/* Overlay Unmute Button jika browser memblokir autoplay audio */}
            {isMuted && !playerError && !isMiniPlayerActive && (
              <div
                onClick={sendUnmute}
                className="absolute bottom-4 left-4 z-20 cursor-pointer select-none animate-in fade-in duration-200"
                title="Klik untuk menyalakan audio kajian"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    sendUnmute();
                  }}
                  className="px-4 py-2 rounded-full bg-black/85 hover:bg-black/95 backdrop-blur-md text-white text-xs font-bold flex items-center gap-2 shadow-xl border border-white/20 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-amber-400 animate-pulse">
                    volume_off
                  </span>
                  <span>Klik untuk Nyalakan Suara</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. INFO & ACTION CARD BERGAYA HOMEPAGE */}
          <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-2xs space-y-4">
            <h1 className="text-base sm:text-lg lg:text-xl font-extrabold text-on-surface leading-snug tracking-tight">
              {currentVideo.title}
            </h1>

            {/* Baris Saluran & Tombol Aksi */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 pb-3 border-b border-outline-variant/20">
              {/* Sisi Kiri: Profil Saluran & Ustadz */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {currentVideo.channelHandle ? (
                  <a
                    href={`https://www.youtube.com/${currentVideo.channelHandle.startsWith('@') ? currentVideo.channelHandle : `@${currentVideo.channelHandle}`}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full overflow-hidden bg-surface-container shrink-0 border border-outline-variant/30 shadow-2xs hover:opacity-85 transition-opacity cursor-pointer"
                    title={`Kunjungi saluran ${currentVideo.channelName} di YouTube`}
                  >
                    {currentVideo.avatarUrl ? (
                      <img
                        src={currentVideo.avatarUrl}
                        alt={currentVideo.channelName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#e4eee8] text-[#126947] font-bold flex items-center justify-center text-sm">
                        {currentVideo.channelName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </a>
                ) : (
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container shrink-0 border border-outline-variant/30 shadow-2xs">
                    {currentVideo.avatarUrl ? (
                      <img
                        src={currentVideo.avatarUrl}
                        alt={currentVideo.channelName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#e4eee8] text-[#126947] font-bold flex items-center justify-center text-sm">
                        {currentVideo.channelName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}

                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    {currentVideo.channelHandle ? (
                      <a
                        href={`https://www.youtube.com/${currentVideo.channelHandle.startsWith('@') ? currentVideo.channelHandle : `@${currentVideo.channelHandle}`}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-extrabold text-sm text-on-surface hover:text-[#126947] hover:underline truncate transition-colors cursor-pointer"
                        title={`Kunjungi saluran ${currentVideo.channelName} di YouTube`}
                      >
                        {currentVideo.channelName}
                      </a>
                    ) : (
                      <h3 className="font-extrabold text-sm text-on-surface truncate">
                        {currentVideo.channelName}
                      </h3>
                    )}
                    <ChannelVerifiedBadge size="sm" />
                  </div>
                  {currentVideo.speakerName ? (
                    <p className="text-xs text-on-surface-variant font-medium truncate mt-0.5">
                      Pemateri:{' '}
                      <span className="text-on-surface font-semibold">
                        {currentVideo.speakerName}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-outline font-medium truncate mt-0.5">
                      Saluran Dakwah Islam Terverifikasi
                    </p>
                  )}
                </div>
              </div>

              {/* Sisi Kanan: Action Buttons (Gaya Homepage) */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {onOpenStudyMode && (
                  <button
                    type="button"
                    onClick={() => onOpenStudyMode(currentVideo)}
                    className="h-9 px-4 rounded-xl bg-[#126947] hover:bg-[#0e5237] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                    title="Buka Mode Belajar untuk menyimak sambil mencatat faidah kajian"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit_note</span>
                    <span>Catat Faidah</span>
                  </button>
                )}

                {onPlayGlobalMiniPlayer && (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        if (iframeRef.current) {
                          sendMute(iframeRef.current);
                          sendPauseVideo(iframeRef.current);
                          sendStopVideo(iframeRef.current);
                          iframeRef.current.src = 'about:blank';
                        }
                      } catch {}

                      onPlayGlobalMiniPlayer(currentVideo);
                    }}
                    className="h-9 px-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-bold inline-flex items-center gap-1.5 border border-outline-variant/30 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                    title="Pindahkan ke pemutar mengambang mini di pojok kanan bawah"
                  >
                    <span className="material-symbols-outlined text-[16px] text-rose-500">
                      picture_in_picture_alt
                    </span>
                    <span>Mini Player</span>
                  </button>
                )}

                {onShare && (
                  <button
                    type="button"
                    onClick={() => onShare(currentVideo)}
                    className="h-9 px-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-bold inline-flex items-center gap-1.5 border border-outline-variant/30 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                    title="Bagikan Tautan Kajian"
                  >
                    <span className="material-symbols-outlined text-[16px]">share</span>
                    <span>Bagikan</span>
                  </button>
                )}

                <a
                  href={`https://www.youtube.com/watch?v=${currentVideo.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-bold inline-flex items-center gap-1.5 border border-outline-variant/30 active:scale-95 transition-all whitespace-nowrap"
                  title="Buka di situs YouTube"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>YouTube</span>
                </a>
              </div>
            </div>

            {/* Kotak Deskripsi */}
            <div
              onClick={() => setIsDescExpanded((prev) => !prev)}
              className="p-3.5 rounded-xl bg-surface-container-low/70 hover:bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface-variant space-y-1.5 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 font-bold text-on-surface text-[11px] sm:text-xs">
                {currentVideo.isLive ? (
                  <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-extrabold">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span>Sedang Tayang Langsung</span>
                  </span>
                ) : currentVideo.timeText ? (
                  <span>Waktu Siaran: {currentVideo.timeText}</span>
                ) : (
                  <span>Siaran Kajian Ilmiah Islam</span>
                )}
                <span>·</span>
                <span>Disiarkan oleh {currentVideo.channelName}</span>
              </div>

              <p
                className={`text-on-surface-variant/90 leading-relaxed ${
                  isDescExpanded ? '' : 'line-clamp-2'
                }`}
              >
                Kajian Islam disiarkan melalui saluran resmi YouTube {currentVideo.channelName}.
                {currentVideo.speakerName
                  ? ` Pemateri yang mengisi taklim: ${currentVideo.speakerName}.`
                  : ''}{' '}
                Simak dengan adab menuntut ilmu dan manfaatkan fitur Mode Belajar untuk mencatat
                rangkuman faidah secara langsung.
              </p>

              <button
                type="button"
                className="font-bold text-[#126947] dark:text-emerald-400 hover:underline transition-colors cursor-pointer text-[11px] pt-0.5 block"
              >
                {isDescExpanded ? 'Tampilkan Lebih Sedikit' : 'Selengkapnya...'}
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================
            KOLOM KANAN (32%): PANEL REKOMENDASI KAJIAN TERKAIT (GAYA HOMEPAGE)
           ======================================================== */}
        <aside className="w-full lg:w-[34%] xl:w-[31%] rounded-2xl bg-surface-container-lowest border border-outline-variant/25 p-4 shadow-2xs flex flex-col gap-3.5 shrink-0">
          {/* Header Sidebar */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-extrabold text-[15px] text-on-surface tracking-tight">
                Daftar Siaran &amp; Rekaman
              </h2>
              <p className="text-[11px] text-on-surface-variant font-medium">
                Pilih video untuk langsung memutar di samping
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#e4eee8] dark:bg-emerald-950/60 text-[#126947] dark:text-emerald-300 text-[11px] font-extrabold shrink-0">
              {relatedVideos.length} Video
            </span>
          </div>

          {/* Indikator Pencarian Aktif */}
          {searchQuery && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="material-symbols-outlined text-[15px] text-[#126947] shrink-0">
                  search
                </span>
                <span className="truncate text-on-surface-variant">
                  Filter: <strong className="text-on-surface font-bold">"{searchQuery}"</strong>
                </span>
              </div>
              {onClearSearch && (
                <button
                  type="button"
                  onClick={onClearSearch}
                  className="text-[11px] text-[#126947] dark:text-emerald-400 hover:underline font-bold ml-2 shrink-0 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {/* Filter Pills Bergaya Homepage (Rounded-Full) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <button
              type="button"
              onClick={() => setSidebarFilter('live')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border active:scale-95 ${
                sidebarFilter === 'live'
                  ? 'bg-[#126947] text-white border-[#126947] shadow-2xs'
                  : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant border-outline-variant/25'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  liveChannels.length > 0 ? 'bg-rose-500 animate-pulse' : 'bg-current opacity-50'
                }`}
              />
              <span>Live ({liveChannels.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSidebarFilter('upcoming')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border active:scale-95 ${
                sidebarFilter === 'upcoming'
                  ? 'bg-[#126947] text-white border-[#126947] shadow-2xs'
                  : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant border-outline-variant/25'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              <span>Terjadwal ({upcomingStreams.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSidebarFilter('ended')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border active:scale-95 ${
                sidebarFilter === 'ended'
                  ? 'bg-[#126947] text-white border-[#126947] shadow-2xs'
                  : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant border-outline-variant/25'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">history</span>
              <span>Rekaman ({endedStreams.length})</span>
            </button>
          </div>

          {/* List Kartu Video Sidebar */}
          <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">
            {relatedVideos.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-surface-container-low/60 border border-outline-variant/25 text-outline text-xs space-y-2">
                <span className="material-symbols-outlined text-[28px] text-on-surface-variant">
                  {searchQuery ? 'search_off' : 'videocam_off'}
                </span>
                <p className="font-bold text-on-surface">
                  {searchQuery
                    ? 'Tidak Ada Kajian yang Cocok'
                    : 'Belum Ada Siaran dalam Kategori Ini'}
                </p>
                <p className="text-[11px] text-on-surface-variant max-w-xs mx-auto">
                  {searchQuery
                    ? `Tidak ditemukan kajian untuk "${searchQuery}".`
                    : sidebarFilter === 'live'
                    ? 'Saat ini belum ada saluran yang sedang menyiarkan kajian langsung. Silakan jelajahi tab Rekaman.'
                    : 'Belum ada siaran kajian dakwah pada filter yang dipilih.'}
                </p>
                {sidebarFilter === 'live' && !searchQuery && endedStreams.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSidebarFilter('ended')}
                    className="mt-2 px-3.5 py-1.5 rounded-full bg-[#126947] text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">history</span>
                    <span>Lihat Rekaman Selesai</span>
                  </button>
                )}
              </div>
            ) : (
              relatedVideos.map((video) => {
                const posterUrl = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
                const isPlaying = video.videoId === currentVideo.videoId;

                return (
                  <div
                    key={video.videoId}
                    onClick={() => {
                      if (!isPlaying) {
                        onSelectVideo(video);
                      } else {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                    className={`flex items-start gap-3 p-2.5 rounded-2xl transition-all select-none border group ${
                      isPlaying
                        ? 'bg-[#e4eee8]/65 dark:bg-emerald-950/40 border-[#126947] shadow-2xs cursor-default'
                        : 'bg-surface-container-low/40 hover:bg-surface-container-low border-outline-variant/20 hover:border-[#126947]/35 cursor-pointer'
                    }`}
                  >
                    {/* Thumbnail 16:9 Compact */}
                    <div className="w-36 aspect-video rounded-xl overflow-hidden bg-surface-container shrink-0 relative border border-outline-variant/20">
                      <img
                        src={posterUrl}
                        alt={video.title}
                        loading="lazy"
                        className={`w-full h-full object-cover transition-transform duration-300 ${
                          isPlaying ? '' : 'group-hover:scale-105'
                        }`}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />

                      {isPlaying ? (
                        <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex items-center justify-center text-white">
                          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#126947] text-[10px] font-bold text-white shadow-md">
                            <span className="material-symbols-outlined text-[13px] animate-pulse">
                              equalizer
                            </span>
                            <span>Diputar</span>
                          </div>
                        </div>
                      ) : (
                        <div className="absolute bottom-1 right-1 pointer-events-none">
                          {video.isLive ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider shadow">
                              LIVE
                            </span>
                          ) : video.timeText ? (
                            <span className="px-1.5 py-0.5 rounded bg-black/80 text-white text-[9px] font-semibold shadow">
                              {video.timeText}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Informasi Detail Teks */}
                    <div className="flex-1 min-w-0 py-0.5">
                      <h4
                        className={`font-bold text-xs line-clamp-2 leading-snug transition-colors ${
                          isPlaying
                            ? 'text-[#126947] dark:text-emerald-300 font-extrabold'
                            : 'text-on-surface group-hover:text-[#126947] dark:group-hover:text-emerald-400'
                        }`}
                        title={video.title}
                      >
                        {video.title}
                      </h4>
                      <p className="text-[11px] text-on-surface-variant font-medium truncate mt-1 flex items-center gap-1">
                        <span className="truncate">{video.channelName}</span>
                        <ChannelVerifiedBadge size="xs" />
                      </p>
                      {video.speakerName && (
                        <p className="text-[10px] text-outline font-medium truncate mt-0.5">
                          {video.speakerName}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

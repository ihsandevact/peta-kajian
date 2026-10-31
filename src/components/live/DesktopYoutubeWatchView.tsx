'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type {
  YoutubeChannel,
  UpcomingStreamItem,
  EndedStreamItem,
} from '@/lib/services/youtubeTracker';
import { formatUpcomingTime, formatEndedTime } from '@/lib/services/youtubeTracker';
import { ChannelVerifiedBadge } from './ChannelVerifiedBadge';

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
}: DesktopYoutubeWatchViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [playerError, setPlayerError] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState<'live' | 'upcoming' | 'ended'>(() => {
    const hasOtherLive = liveChannels.some(
      (c) => Boolean(c.current_video_id) && c.current_video_id !== currentVideo.videoId
    );
    return hasOtherLive ? 'live' : 'ended';
  });
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // Reset error & mute state saat berganti video
  useEffect(() => {
    setPlayerError(false);
    setIsMuted(true);
  }, [currentVideo.videoId]);

  // Helper picu playVideo & unMute
  const sendPlay = useCallback(() => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
          '*'
        );
      }
    } catch {}
  }, []);

  const sendUnmute = useCallback(() => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
          '*'
        );
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }),
          '*'
        );
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
          '*'
        );
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
        if (c.current_video_id && c.current_video_id !== currentVideo.videoId) {
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
        if (u.videoId && u.videoId !== currentVideo.videoId) {
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
        if (e.videoId && e.videoId !== currentVideo.videoId) {
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

    return list;
  }, [liveChannels, upcomingStreams, endedStreams, sidebarFilter, currentVideo.videoId]);

  return (
    <div className="w-full font-geist">
      {/* DUA KOLOM UTAMA KHAS YOUTUBE DESKTOP */}
      <div className="flex flex-col lg:flex-row items-start gap-6 w-full">
        {/* ========================================================
            KOLOM KIRI (70%): PLAYER BESAR + DETAIL + ACTION BAR
           ======================================================== */}
        <div className="w-full lg:w-[68%] xl:w-[72%] flex flex-col">
          {/* 1. PLAYER 16:9 BESAR */}
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-xl border border-surface-container-high/60">
            {isMiniPlayerActive ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-950 text-center select-none space-y-3 relative overflow-hidden">
                {/* Background thumbnail blur halus */}
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-15 filter blur-lg scale-110 pointer-events-none"
                  style={{ backgroundImage: `url(https://i.ytimg.com/vi/${currentVideo.videoId}/hqdefault.jpg)` }}
                />
                
                <div className="relative z-10 w-14 h-14 rounded-2xl bg-red-600/15 text-red-500 flex items-center justify-center border border-red-500/25 shadow-lg animate-pulse">
                  <span className="material-symbols-outlined text-[30px]">picture_in_picture_alt</span>
                </div>

                <div className="relative z-10 space-y-1 max-w-md">
                  <p className="text-base font-extrabold text-white">
                    Sedang Diputar di Mini Player Pojok Layar
                  </p>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    Video utama dijeda agar audio tidak bertumpuk. Anda dapat menjelajahi halaman lain sambil tetap menyimak kajian.
                  </p>
                </div>

                {onRestoreFromMiniPlayer && (
                  <div className="relative z-10 pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onRestoreFromMiniPlayer}
                      className="px-4 py-2 rounded-full bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold inline-flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
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
                    Saluran YouTube terkait memprivat siaran ini untuk proses editing atau rilis rekaman resmi berkualitas tinggi.
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
                src={`https://www.youtube.com/embed/${currentVideo.videoId}?autoplay=1&mute=1&enablejsapi=1&playsinline=1&rel=0`}
                title={currentVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="w-full h-full border-0"
                onLoad={() => {
                  try {
                    iframeRef.current?.contentWindow?.postMessage(
                      JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
                      '*'
                    );
                    setTimeout(() => {
                      sendPlay();
                      sendUnmute();
                    }, 400);
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

          {/* 2. JUDUL KAJIAN */}
          <h1 className="text-base sm:text-lg lg:text-xl font-extrabold text-on-surface mt-3.5 leading-snug">
            {currentVideo.title}
          </h1>

          {/* 3. BARIS SALURAN & TOMBOL AKSI TERPADU (GAYA YOUTUBE DESKTOP) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 pb-3 border-b border-surface-container-high/60">
            {/* Sisi Kiri: Profil Saluran & Ustadz */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {currentVideo.channelHandle ? (
                <a
                  href={`https://www.youtube.com/${currentVideo.channelHandle.startsWith('@') ? currentVideo.channelHandle : `@${currentVideo.channelHandle}`}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full overflow-hidden bg-surface-container shrink-0 border border-surface-container-high/70 shadow-2xs hover:opacity-85 transition-opacity cursor-pointer"
                  title={`Kunjungi saluran ${currentVideo.channelName} di YouTube`}
                >
                  {currentVideo.avatarUrl ? (
                    <img
                      src={currentVideo.avatarUrl}
                      alt={currentVideo.channelName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-red-600/10 text-red-600 dark:text-red-400 font-bold flex items-center justify-center text-sm">
                      {currentVideo.channelName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </a>
              ) : (
                <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container shrink-0 border border-surface-container-high/70 shadow-2xs">
                  {currentVideo.avatarUrl ? (
                    <img
                      src={currentVideo.avatarUrl}
                      alt={currentVideo.channelName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-red-600/10 text-red-600 dark:text-red-400 font-bold flex items-center justify-center text-sm">
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
                      className="font-extrabold text-sm text-on-surface hover:text-primary hover:underline truncate transition-colors cursor-pointer"
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
                    Pemateri: <span className="text-on-surface font-semibold">{currentVideo.speakerName}</span>
                  </p>
                ) : (
                  <p className="text-xs text-outline font-medium truncate mt-0.5">
                    Saluran Dakwah Islam
                  </p>
                )}
              </div>
            </div>

            {/* Sisi Kanan: Action Buttons (Khas YouTube Desktop) */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {/* Tombol Mode Belajar (Catat Faidah) */}
              {onOpenStudyMode && (
                <button
                  type="button"
                  onClick={() => onOpenStudyMode(currentVideo)}
                  className="h-9 px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                  title="Buka Mode Belajar untuk menyimak sambil mencatat faidah kajian"
                >
                  <span className="material-symbols-outlined text-[17px]">edit_note</span>
                  <span>Catat Faidah</span>
                </button>
              )}

              {/* Tombol Putar di Mini Player */}
              {onPlayGlobalMiniPlayer && (
                <button
                  type="button"
                  onClick={() => onPlayGlobalMiniPlayer(currentVideo)}
                  className="h-9 px-3.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold inline-flex items-center gap-1.5 border border-surface-container-high/60 shadow-2xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                  title="Pindahkan ke pemutar mengambang mini di pojok kanan bawah"
                >
                  <span className="material-symbols-outlined text-[16px] text-red-600">picture_in_picture_alt</span>
                  <span>Putar di Pojok</span>
                </button>
              )}

              {/* Tombol Bagikan */}
              {onShare && (
                <button
                  type="button"
                  onClick={() => onShare(currentVideo)}
                  className="h-9 px-3.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold inline-flex items-center gap-1.5 border border-surface-container-high/60 shadow-2xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                  title="Bagikan Tautan Kajian"
                >
                  <span className="material-symbols-outlined text-[16px]">share</span>
                  <span>Bagikan</span>
                </button>
              )}

              {/* Tombol Buka di YouTube */}
              <a
                href={`https://www.youtube.com/watch?v=${currentVideo.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold inline-flex items-center gap-1.5 border border-surface-container-high/60 shadow-2xs active:scale-95 transition-all whitespace-nowrap"
                title="Buka di situs YouTube"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                <span>YouTube</span>
              </a>
            </div>
          </div>

          {/* 4. KOTAK DESKRIPSI (YOUTUBE DESCRIPTION BOX) */}
          <div className="mt-3.5 p-3.5 sm:p-4 rounded-2xl bg-surface-container-low border border-surface-container-high/60 text-xs text-on-surface-variant space-y-2">
            <div className="flex items-center gap-2 font-bold text-on-surface text-[11px] sm:text-xs">
              {currentVideo.isLive ? (
                <span className="inline-flex items-center gap-1 text-red-600 font-extrabold">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  <span>Sedang Tayang Langsung</span>
                </span>
              ) : currentVideo.timeText ? (
                <span>Waktu Siaran: {currentVideo.timeText}</span>
              ) : (
                <span>Siaran Kajian Ilmiah Islam</span>
              )}
              <span>•</span>
              <span>Disiarkan oleh {currentVideo.channelName}</span>
            </div>

            <p className={`text-on-surface-variant/90 leading-relaxed ${isDescExpanded ? '' : 'line-clamp-2'}`}>
              Kajian Islam disiarkan melalui saluran resmi YouTube {currentVideo.channelName}.
              {currentVideo.speakerName ? ` Pemateri yang mengisi taklim: ${currentVideo.speakerName}.` : ''} Simak dengan adab menuntut ilmu dan manfaatkan fitur Mode Belajar untuk mencatat rangkuman faidah secara langsung.
            </p>

            <button
              type="button"
              onClick={() => setIsDescExpanded((prev) => !prev)}
              className="font-bold text-on-surface hover:text-primary transition-colors cursor-pointer text-[11px] pt-1 block"
            >
              {isDescExpanded ? 'Tampilkan Lebih Sedikit' : 'Selengkapnya...'}
            </button>
          </div>
        </div>

        {/* ========================================================
            KOLOM KANAN (30%): DAFTAR REKOMENDASI KAjiAN TERKAIT
           ======================================================== */}
        <div className="w-full lg:w-[32%] xl:w-[28%] flex flex-col gap-3 shrink-0">
          {/* Header Sidebar & Filter Chips Mini */}
          <div className="flex items-center justify-between gap-1 pb-1">
            <h2 className="font-extrabold text-sm text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[17px] text-red-600">video_library</span>
              <span>Kajian Lainnya</span>
            </h2>
            <span className="text-[11px] text-outline font-semibold">
              {relatedVideos.length} Video
            </span>
          </div>

          {/* Filter Chips Horizontal Mini */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'live', label: '🔴 Live' },
              { id: 'upcoming', label: '⏰ Mendatang' },
              { id: 'ended', label: '📼 Rekaman' },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSidebarFilter(chip.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  sidebarFilter === chip.id
                    ? 'bg-on-surface text-surface'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* List Kartu Compact Khas YouTube Sidebar */}
          <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
            {relatedVideos.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-surface-container-low border border-surface-container-high/60 text-outline text-xs space-y-1">
                <span className="material-symbols-outlined text-[24px]">videocam_off</span>
                <p>Tidak ada siaran lain dalam kategori ini.</p>
              </div>
            ) : (
              relatedVideos.map((video) => {
                const posterUrl = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;

                return (
                  <div
                    key={video.videoId}
                    onClick={() => onSelectVideo(video)}
                    className="flex items-start gap-2.5 p-1.5 rounded-xl hover:bg-surface-container-low cursor-pointer transition-colors group select-none"
                  >
                    {/* Thumbnail 16:9 Compact */}
                    <div className="w-36 sm:w-40 aspect-video rounded-xl overflow-hidden bg-surface-container shrink-0 relative shadow-2xs">
                      <img
                        src={posterUrl}
                        alt={video.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />

                      {/* Badge Status */}
                      <div className="absolute bottom-1 right-1 pointer-events-none">
                        {video.isLive ? (
                          <span className="px-1.5 py-0.2 rounded bg-red-600 text-white text-[9px] font-black uppercase tracking-wider shadow">
                            LIVE
                          </span>
                        ) : video.timeText ? (
                          <span className="px-1.5 py-0.2 rounded bg-black/80 text-white text-[9px] font-semibold shadow">
                            {video.timeText}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Informasi Detail Teks */}
                    <div className="flex-1 min-w-0 py-0.5">
                      <h4
                        className="font-bold text-xs text-on-surface line-clamp-2 leading-snug group-hover:text-red-600 transition-colors"
                        title={video.title}
                      >
                        {video.title}
                      </h4>
                      <p className="text-[11px] text-on-surface-variant font-medium truncate mt-1 flex items-center gap-1">
                        <span>{video.channelName}</span>
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
        </div>
      </div>
    </div>
  );
}

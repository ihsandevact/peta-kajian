'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface SwipeFeedItem {
  id: string;
  videoId: string;
  title: string;
  speakerName: string;
  channelName: string;
  posterUrl?: string;
  isLive: boolean;
  timeText?: string;
}

export interface MobileSwipeLiveViewerProps {
  items: SwipeFeedItem[];
  initialIndex: number;
  isOpen: boolean;
  onClose?: () => void;
  onSwitchToList: () => void;
  onPlayMiniPlayer: (stream: {
    videoId: string;
    title: string;
    channelName: string;
    speakerName?: string;
  }) => void;
}

export default function MobileSwipeLiveViewer({
  items,
  initialIndex,
  isOpen,
  onClose,
  onSwitchToList,
  onPlayMiniPlayer,
}: MobileSwipeLiveViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Touch gesture & drag offset state
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const touchCurrentY = useRef<number | null>(null);

  // Iframe ref for active playing video
  const activeIframeRef = useRef<HTMLIFrameElement>(null);

  // Sync initialIndex when viewer opens or changes
  useEffect(() => {
    if (isOpen && items.length > 0) {
      const validIndex = Math.max(0, Math.min(initialIndex, items.length - 1));
      setCurrentIndex(validIndex);
      setDragOffset(0);
      setIsPaused(false);
      setIsTitleExpanded(false);
    }
  }, [isOpen, initialIndex, items.length]);

  // Reset pause state whenever currentIndex changes
  useEffect(() => {
    setIsPaused(false);
  }, [currentIndex]);

  // Toast auto-hide
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // PostMessage helper to YouTube Player
  const sendIframeCommand = useCallback((func: string, args: any[] = []) => {
    try {
      if (activeIframeRef.current?.contentWindow) {
        activeIframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      }
    } catch {}
  }, []);

  // Unmute and play helper
  const handleUnmute = useCallback(() => {
    sendIframeCommand('unMute');
    sendIframeCommand('setVolume', [100]);
    sendIframeCommand('playVideo');
    setIsMuted(false);
    setIsPaused(false);
  }, [sendIframeCommand]);

  // Mute toggle helper
  const toggleMute = useCallback(() => {
    if (isMuted) {
      handleUnmute();
    } else {
      sendIframeCommand('mute');
      setIsMuted(true);
    }
  }, [isMuted, handleUnmute, sendIframeCommand]);

  // Play / Pause toggle helper ala TikTok
  const togglePlayPause = useCallback(() => {
    if (isPaused) {
      sendIframeCommand('playVideo');
      setIsPaused(false);
    } else {
      sendIframeCommand('pauseVideo');
      setIsPaused(true);
    }
  }, [isPaused, sendIframeCommand]);

  // Navigation handlers
  const goToNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsTitleExpanded(false);
      setIsPaused(false);
    }
  }, [currentIndex, items.length]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsTitleExpanded(false);
      setIsPaused(false);
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, goToNext, goToPrev, togglePlayPause]);

  // Touch event handlers for vertical swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    touchCurrentY.current = e.touches[0].clientY;
    const diff = touchCurrentY.current - touchStartY.current;

    // Resistance saat berada di batas atas atau batas bawah
    if ((currentIndex === 0 && diff > 0) || (currentIndex === items.length - 1 && diff < 0)) {
      setDragOffset(diff * 0.25);
    } else {
      setDragOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartY.current === null || touchCurrentY.current === null) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const diff = touchCurrentY.current - touchStartY.current;
    const threshold = 65; // Jarak geser piksel minimal

    if (diff < -threshold && currentIndex < items.length - 1) {
      // Geser ke atas -> Next Video
      setCurrentIndex((prev) => prev + 1);
      setIsTitleExpanded(false);
      setIsPaused(false);
    } else if (diff > threshold && currentIndex > 0) {
      // Geser ke bawah -> Previous Video
      setCurrentIndex((prev) => prev - 1);
      setIsTitleExpanded(false);
      setIsPaused(false);
    }

    setIsDragging(false);
    setDragOffset(0);
    touchStartY.current = null;
    touchCurrentY.current = null;
  };

  // Web Share API handler
  const handleShare = async (item: SwipeFeedItem) => {
    const videoId = item.videoId;
    if (!videoId) return;

    const shareUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const shareTitle = item.title;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `Simak kajian: ${shareTitle}`,
          url: shareUrl,
        });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setToastMessage('Tautan siaran berhasil disalin!');
      } catch {
        setToastMessage('Gagal menyalin tautan.');
      }
    }
  };

  if (!isOpen || items.length === 0) return null;

  const currentItem = items[currentIndex];
  if (!currentItem || !currentItem.videoId) return null;

  const currentVideoId = currentItem.videoId;
  const currentTitle = currentItem.title;
  const currentSpeaker = currentItem.speakerName;
  const currentPoster = currentItem.posterUrl || `https://i.ytimg.com/vi/${currentVideoId}/hqdefault.jpg`;

  return (
    <div
      className="fixed inset-0 z-40 bg-black text-white flex flex-col justify-between select-none overflow-hidden touch-none font-geist"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* AMBIENT BLURRED BACKDROP DARI POSTER VIDEO */}
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-35 scale-125 pointer-events-none transition-all duration-700"
        style={{ backgroundImage: `url(${currentPoster})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none z-1" />

      {/* TOP HEADER OVERLAY */}
      <header className="relative z-20 px-4 pt-[calc(10px+env(safe-area-inset-top,10px))] pb-2 flex items-center justify-between gap-2">
        {/* Indikator Status & Counter */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 shadow-lg">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              currentItem.isLive ? 'bg-red-600 animate-pulse' : 'bg-blue-500'
            }`}
          />
          <span className="text-xs font-bold tracking-wide">
            {currentIndex + 1} / {items.length} {currentItem.isLive ? 'Live' : 'Kajian'}
          </span>
        </div>

        {/* Action Header: Mode Jelajah & Bagikan */}
        <div className="flex items-center gap-2">
          {/* Tombol Beralih ke Halaman Jelajah / Katalog */}
          <button
            type="button"
            onClick={onSwitchToList}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/20 text-xs font-bold text-white shadow-lg active:scale-95 transition-all cursor-pointer"
            title="Beralih ke Halaman Jelajah & Pencarian"
          >
            <span className="material-symbols-outlined text-[17px] text-amber-400">
              explore
            </span>
            <span>Jelajah</span>
          </button>

          {/* Tombol Bagikan */}
          <button
            type="button"
            onClick={() => handleShare(currentItem)}
            className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-md flex items-center justify-center text-white border border-white/20 active:scale-95 transition-all cursor-pointer shadow-lg"
            aria-label="Bagikan Siaran"
          >
            <span className="material-symbols-outlined text-[17px]">share</span>
          </button>
        </div>
      </header>

      {/* TOAST NOTIFIKASI */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-black/85 backdrop-blur-md border border-white/20 text-white text-xs font-medium shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          {toastMessage}
        </div>
      )}

      {/* SLIDER CONTAINER WITH VIRTUALIZATION & LIVE DRAG TRANSFORM */}
      <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden z-10">
        <div
          className="w-full h-full flex flex-col items-center justify-center relative transition-transform"
          style={{
            transform: `translateY(${dragOffset}px)`,
            transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          {/* VIDEO FRAME 16:9 TERPUSAT */}
          <div className="w-full max-w-lg aspect-video bg-black relative shadow-2xl overflow-hidden border-y border-white/10 sm:border sm:rounded-2xl">
            <iframe
              key={currentVideoId}
              ref={activeIframeRef}
              src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1&mute=${isMuted ? 1 : 0}&enablejsapi=1&playsinline=1&rel=0&modestbranding=1`}
              title={currentTitle}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full h-full border-0 pointer-events-none"
              onLoad={() => {
                try {
                  activeIframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
                    '*'
                  );
                  setTimeout(() => {
                    sendIframeCommand('playVideo');
                    if (!isMuted) {
                      sendIframeCommand('unMute');
                      sendIframeCommand('setVolume', [100]);
                    }
                  }, 400);
                } catch {}
              }}
            />

            {/* Tap to Play/Pause Overlay Ala TikTok */}
            <div
              onClick={togglePlayPause}
              className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center select-none"
              aria-label={isPaused ? 'Putar Video' : 'Jeda Video'}
            >
              {/* Centered Frosted Play Icon saat di-Pause */}
              {isPaused && (
                <div className="w-16 h-16 rounded-full bg-black/65 backdrop-blur-md text-white flex items-center justify-center shadow-2xl border border-white/20 animate-in zoom-in-75 duration-200">
                  <span className="material-symbols-outlined text-[38px] ml-1">play_arrow</span>
                </div>
              )}
            </div>

            {/* Quick Unmute Overlay saat video termute */}
            {isMuted && (
              <div
                onClick={handleUnmute}
                className="absolute bottom-3 left-3 z-20 cursor-pointer select-none animate-in fade-in duration-200"
              >
                <div className="px-3 py-1.5 rounded-full bg-black/80 hover:bg-black/95 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 shadow-xl border border-white/20 active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-[16px] text-amber-400 animate-pulse">
                    volume_off
                  </span>
                  <span>Ketuk untuk Suara</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TIKTOK-STYLE ACTION BAR DI SEBELAH KANAN (MINIMALIS & BERSIH) */}
        <aside className="absolute right-3.5 bottom-28 z-30 flex flex-col items-center gap-4">
          {/* Tombol Suara / Mute */}
          <button
            type="button"
            onClick={toggleMute}
            className={`w-11 h-11 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer shadow-xl border active:scale-90 ${
              isMuted
                ? 'bg-amber-500/20 border-amber-400 text-amber-400 backdrop-blur-md animate-pulse'
                : 'bg-black/50 border-white/20 text-white hover:bg-black/75 backdrop-blur-md'
            }`}
            title={isMuted ? 'Nyalakan Suara' : 'Matikan Suara'}
          >
            <span className="material-symbols-outlined text-[21px]">
              {isMuted ? 'volume_off' : 'volume_up'}
            </span>
          </button>

          {/* Tombol Mini Player (Putar di Pojok & Kembali ke Halaman Jelajah) */}
          <button
            type="button"
            onClick={() => {
              onSwitchToList();
              onPlayMiniPlayer({
                videoId: currentVideoId,
                title: currentTitle,
                channelName: currentItem.channelName,
                speakerName: currentSpeaker,
              });
            }}
            className="w-11 h-11 rounded-full bg-black/50 hover:bg-black/75 border border-white/20 text-white flex items-center justify-center transition-all cursor-pointer shadow-xl backdrop-blur-md active:scale-90"
            title="Lanjutkan di Mini Player pojok & buka halaman Jelajah"
          >
            <span className="material-symbols-outlined text-[20px] text-red-500">
              picture_in_picture_alt
            </span>
          </button>
        </aside>
      </div>

      {/* BOTTOM OVERLAY INFO & SWIPE HINT (DIBERI PADDING DI ATAS BOTTOM NAV) */}
      <footer className="relative z-20 px-4 pb-[calc(76px+env(safe-area-inset-bottom,16px))] pt-2 flex flex-col gap-2 bg-gradient-to-t from-black via-black/85 to-transparent">
        {/* Info Pemateri & Channel */}
        <div className="pr-16 flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            {currentItem.isLive ? (
              <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-black tracking-wider uppercase flex items-center gap-1 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-blue-600/90 text-white text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 shadow-xs">
                <span className="material-symbols-outlined text-[12px]">history</span>
                REKAMAN
              </span>
            )}
            <span className="text-xs font-bold text-white truncate max-w-[200px]">
              {currentItem.channelName}
            </span>
            {currentItem.timeText && (
              <span className="text-[10px] text-white/60">
                • {currentItem.timeText}
              </span>
            )}
          </div>

          <p className="text-xs font-semibold text-amber-300 truncate">
            {currentSpeaker}
          </p>

          <p
            onClick={() => setIsTitleExpanded(!isTitleExpanded)}
            className={`text-xs text-white/90 leading-snug cursor-pointer transition-all ${
              isTitleExpanded ? 'line-clamp-none' : 'line-clamp-2'
            }`}
          >
            {currentTitle}
          </p>
        </div>

        {/* SWIPE HINT / QUICK PREV-NEXT NAVIGATION */}
        <div className="pt-1.5 flex items-center justify-between text-[11px] text-white/60 border-t border-white/10">
          <button
            type="button"
            onClick={goToPrev}
            disabled={currentIndex === 0}
            className={`flex items-center gap-1 transition-opacity ${
              currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:text-white cursor-pointer active:scale-95'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">expand_less</span>
            <span>Sebelumnya</span>
          </button>

          <div className="flex items-center gap-1 text-white/70 font-medium">
            <span className="material-symbols-outlined text-[15px] animate-bounce text-red-500">
              swipe_vertical
            </span>
            <span>Geser {currentIndex < items.length - 1 ? 'ke atas' : 'ke bawah'}</span>
          </div>

          <button
            type="button"
            onClick={goToNext}
            disabled={currentIndex === items.length - 1}
            className={`flex items-center gap-1 transition-opacity ${
              currentIndex === items.length - 1
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:text-white cursor-pointer active:scale-95'
            }`}
          >
            <span>Berikutnya</span>
            <span className="material-symbols-outlined text-[16px]">expand_more</span>
          </button>
        </div>
      </footer>
    </div>
  );
}

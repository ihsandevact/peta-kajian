'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

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

// Helper deteksi perangkat iOS (iPhone / iPad / iPod)
const checkIsIOS = () => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isIosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isIosDevice || isIPadOS;
};

function MobileSwipeLiveViewer({
  items,
  initialIndex,
  isOpen,
  onClose,
  onSwitchToList,
  onPlayMiniPlayer,
}: MobileSwipeLiveViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  // Deteksi khusus iOS (Apple WebKit memblokir unmuted autoplay)
  const [isIOS, setIsIOS] = useState(() => (typeof window !== 'undefined' ? checkIsIOS() : false));
  // Di iOS default = true (muted agar autoplay diizinkan Safari WebKit).
  // Di Android & non-iOS default = false (langsung bersuara seketika).
  const [isMuted, setIsMuted] = useState(() => (typeof window !== 'undefined' ? checkIsIOS() : false));

  useEffect(() => {
    const isApple = checkIsIOS();
    setIsIOS(isApple);
    if (isApple) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  }, []);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoplayFailed, setAutoplayFailed] = useState(false);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Ref untuk melacak upaya kickstart autoplay berkala
  const autoplayAttemptsRef = useRef(0);

  // State untuk melacak apakah pengguna sudah pernah melakukan swipe ke atas dalam sesi kunjungan saat ini
  const [hasSwipedUp, setHasSwipedUp] = useState<boolean>(false);

  // Bersihkan residu key lama dari localStorage jika ada
  useEffect(() => {
    try {
      localStorage.removeItem('peta_kajian_has_swiped_up');
    } catch {}
  }, []);

  // Jika initialIndex > 0 (pengguna membuka video urutan ke-2 atau seterusnya),
  // tandai langsung bahwa penanda tidak perlu muncul
  useEffect(() => {
    if (initialIndex > 0) {
      setHasSwipedUp(true);
    }
  }, [initialIndex]);

  // Helper untuk menandai bahwa pengguna sudah pernah swipe ke atas pada sesi ini
  const markSwipedUp = useCallback(() => {
    setHasSwipedUp(true);
  }, []);

  // Touch gesture & drag offset state
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const touchCurrentY = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);

  // Bersihkan rafId saat komponen di-unmount
  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  // Preload poster video berikutnya & sebelumnya di latar belakang agar transisi swipe instan tanpa kedip
  useEffect(() => {
    if (items.length === 0) return;
    const nextPoster = items[currentIndex + 1]?.posterUrl;
    if (nextPoster) {
      const img = new Image();
      img.src = nextPoster;
    }
    const prevPoster = items[currentIndex - 1]?.posterUrl;
    if (prevPoster) {
      const img = new Image();
      img.src = prevPoster;
    }
  }, [currentIndex, items]);

  // Iframe ref for active playing video
  const activeIframeRef = useRef<HTMLIFrameElement>(null);
  // Ref untuk melacak apakah jeda video berasal dari ketukan sengaja pengguna
  const isUserPausedRef = useRef<boolean>(false);

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

  // Video pertama yang dijadikan src dasar permanen pada iframe
  const initialVideoId = useMemo(() => {
    const validIndex = Math.max(0, Math.min(initialIndex, items.length - 1));
    return items[validIndex]?.videoId || items[0]?.videoId || '';
  }, [initialIndex, items]);

  // Melacak videoId yang sedang aktif di dalam iframe agar tidak reload berulang
  const loadedVideoIdRef = useRef<string>(initialVideoId);

  // Sync initialIndex when viewer opens or changes
  useEffect(() => {
    if (isOpen && items.length > 0) {
      const validIndex = Math.max(0, Math.min(initialIndex, items.length - 1));
      const targetVideoId = items[validIndex]?.videoId;
      setCurrentIndex(validIndex);
      setDragOffset(0);
      setIsPaused(false);
      setIsPlaying(false);
      setAutoplayFailed(false);
      autoplayAttemptsRef.current = 0;
      isUserPausedRef.current = false;
      setIsTitleExpanded(false);

      if (targetVideoId && loadedVideoIdRef.current !== targetVideoId) {
        loadedVideoIdRef.current = targetVideoId;
        sendIframeCommand('loadVideoById', [targetVideoId, 0]);
        if (!isMuted) {
          sendIframeCommand('unMute');
          sendIframeCommand('setVolume', [100]);
        }
      }
    }
  }, [isOpen, initialIndex, items, isMuted, sendIframeCommand]);

  // Pergantian video secara persisten via YouTube IFrame API (loadVideoById) tanpa menghancurkan iframe DOM
  const currentVideoId = items[currentIndex]?.videoId;
  useEffect(() => {
    if (!isOpen || !currentVideoId) return;

    if (loadedVideoIdRef.current && loadedVideoIdRef.current !== currentVideoId) {
      loadedVideoIdRef.current = currentVideoId;
      sendIframeCommand('loadVideoById', [currentVideoId, 0]);
      if (!isMuted) {
        sendIframeCommand('unMute');
        sendIframeCommand('setVolume', [100]);
      }
    } else if (!loadedVideoIdRef.current) {
      loadedVideoIdRef.current = currentVideoId;
    }
  }, [currentVideoId, isMuted, isOpen, sendIframeCommand]);

  // Reset playback & kickstart states whenever currentIndex changes
  useEffect(() => {
    setIsPaused(false);
    setIsPlaying(false);
    setAutoplayFailed(false);
    autoplayAttemptsRef.current = 0;
    isUserPausedRef.current = false;
  }, [currentIndex]);

  // Deteksi jika autoplay tertahan browser khusus di iOS (misal saat Low Power Mode aktif di iPhone)
  useEffect(() => {
    if (!isOpen || !isIOS) return;
    const timer = setTimeout(() => {
      if (!isPlaying && !isUserPausedRef.current) {
        setAutoplayFailed(true);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [isOpen, currentIndex, isPlaying, isIOS]);

  // Toast auto-hide
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Unmute and play helper
  const handleUnmute = useCallback(() => {
    isUserPausedRef.current = false;
    sendIframeCommand('unMute');
    sendIframeCommand('setVolume', [100]);
    sendIframeCommand('playVideo');
    setIsMuted(false);
    setIsPaused(false);
    setIsPlaying(true);
    setAutoplayFailed(false);
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
    if (isPaused || !isPlaying) {
      isUserPausedRef.current = false;
      sendIframeCommand('playVideo');
      setIsPaused(false);
      setIsPlaying(true);
      setAutoplayFailed(false);
    } else {
      isUserPausedRef.current = true;
      sendIframeCommand('pauseVideo');
      setIsPaused(true);
      setIsPlaying(false);
    }
  }, [isPaused, isPlaying, sendIframeCommand]);

  // Handler cerdas ketukan area video ala TikTok / Reels:
  // - Jika video masih hening (misal di iOS): ketukan langsung menyalakan suara (unMute)
  // - Jika belum berputar / dijeda / autoplay tertahan browser (khusus iOS): LANGSUNG playVideo
  // - Jika sudah berputar bersuara: bertindak sebagai toggle play / pause
  const handleVideoAreaTap = useCallback(() => {
    if (isMuted) {
      handleUnmute();
    } else if (!isPlaying || isPaused || (isIOS && autoplayFailed)) {
      isUserPausedRef.current = false;
      sendIframeCommand('playVideo');
      setIsPaused(false);
      setIsPlaying(true);
      setAutoplayFailed(false);
    } else {
      togglePlayPause();
    }
  }, [isMuted, isPlaying, isPaused, isIOS, autoplayFailed, handleUnmute, togglePlayPause, sendIframeCommand]);

  // Handshake berkala & adaptif kickstart autoplay di YouTube iframe (hemat baterai saat stabil)
  useEffect(() => {
    if (!isOpen) return;

    // Polling agresif (500ms) saat belum berputar, melambat ke polling hemat baterai (3000ms) saat stabil
    const pollInterval = isPlaying ? 3000 : 500;

    const interval = setInterval(() => {
      try {
        if (activeIframeRef.current?.contentWindow) {
          activeIframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
            '*'
          );

          // Lakukan kickstart playVideo hingga 6 kali dalam 3 detik pertama jika belum terdeteksi playing
          if (!isUserPausedRef.current && !isPlaying && autoplayAttemptsRef.current < 6) {
            sendIframeCommand('playVideo');
            if (!isMuted) {
              sendIframeCommand('unMute');
              sendIframeCommand('setVolume', [100]);
            }
            autoplayAttemptsRef.current += 1;
          }
        }
      } catch {}
    }, pollInterval);

    return () => clearInterval(interval);
  }, [isOpen, currentIndex, isPlaying, isMuted, sendIframeCommand]);

  // Sinkronisasi status player YouTube (playing/paused/cued/onReady/onAutoplayBlocked) secara real-time
  useEffect(() => {
    if (!isOpen) return;

    const handleWindowMessage = (event: MessageEvent) => {
      try {
        let data = event.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }

        // Tangani event onAutoplayBlocked jika browser Android memblokir pemutaran unmuted
        if (data?.event === 'onAutoplayBlocked') {
          sendIframeCommand('mute');
          sendIframeCommand('playVideo');
          setIsMuted(true);
        }

        // Tangani event onReady langsung dari YouTube widget -> segera picu playVideo
        if (data?.event === 'onReady') {
          if (!isUserPausedRef.current) {
            sendIframeCommand('playVideo');
            if (!isMuted) {
              sendIframeCommand('unMute');
              sendIframeCommand('setVolume', [100]);
            }
          }
        }

        if (data?.event === 'infoDelivery' || data?.info) {
          const info = data.info || data;
          const playerState = info.playerState;

          if (playerState === 1) {
            // Sedang berputar (Playing)
            setIsPlaying(true);
            setIsPaused(false);
            setAutoplayFailed(false);
          } else if (playerState === 2) {
            // Sedang dijeda (Paused)
            if (isUserPausedRef.current) {
              setIsPaused(true);
              setIsPlaying(false);
            } else {
              // Auto-pause oleh browser / background tab -> override agar tetap jalan
              sendIframeCommand('playVideo');
            }
          } else if (playerState === 5 || playerState === -1) {
            // Cued / unstarted -> segera kickstart autoplay
            if (!isUserPausedRef.current) {
              sendIframeCommand('playVideo');
            }
          }

          if (typeof info.muted === 'boolean') {
            setIsMuted(info.muted);
          }
        }
      } catch {}
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [isOpen, sendIframeCommand]);

  // Penanganan background playback & instant auto-resume saat berpindah tab atau jendela
  useEffect(() => {
    if (!isOpen) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' || !document.hidden) {
        // Tab kembali aktif: jika pengguna tidak menjeda secara manual, langsung auto-resume
        if (!isUserPausedRef.current) {
          sendIframeCommand('playVideo');
          if (!isMuted) {
            sendIframeCommand('unMute');
            sendIframeCommand('setVolume', [100]);
          }
        }
      } else {
        // Tab disembunyikan: coba keep-alive pemutaran jika tidak dijeda manual
        if (!isUserPausedRef.current) {
          sendIframeCommand('playVideo');
          setTimeout(() => {
            if (!isUserPausedRef.current) {
              sendIframeCommand('playVideo');
            }
          }, 150);
        }
      }
    };

    const handleWindowFocus = () => {
      if (!isUserPausedRef.current) {
        sendIframeCommand('playVideo');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleVisibilityChange);
    };
  }, [isOpen, isMuted, sendIframeCommand]);

  // Navigation handlers
  const goToNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextItem = items[nextIndex];
      isUserPausedRef.current = false;
      if (isIOS && isMuted) {
        setIsMuted(false);
      }
      if (nextItem?.videoId) {
        loadedVideoIdRef.current = nextItem.videoId;
        sendIframeCommand('loadVideoById', [nextItem.videoId, 0]);
        sendIframeCommand('unMute');
        sendIframeCommand('setVolume', [100]);
      }
      setCurrentIndex(nextIndex);
      setIsTitleExpanded(false);
      setIsPaused(false);
      markSwipedUp();
    }
  }, [currentIndex, items, isIOS, isMuted, markSwipedUp, sendIframeCommand]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      const prevItem = items[prevIndex];
      isUserPausedRef.current = false;
      if (isIOS && isMuted) {
        setIsMuted(false);
      }
      if (prevItem?.videoId) {
        loadedVideoIdRef.current = prevItem.videoId;
        sendIframeCommand('loadVideoById', [prevItem.videoId, 0]);
        sendIframeCommand('unMute');
        sendIframeCommand('setVolume', [100]);
      }
      setCurrentIndex(prevIndex);
      setIsTitleExpanded(false);
      setIsPaused(false);
    }
  }, [currentIndex, items, isIOS, isMuted, sendIframeCommand]);

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
    const targetOffset =
      (currentIndex === 0 && diff > 0) || (currentIndex === items.length - 1 && diff < 0)
        ? diff * 0.25
        : diff;

    // Throttle rendering via requestAnimationFrame agar selaras dengan 60fps/120fps vsync layar
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(() => {
        setDragOffset(targetOffset);
        rafId.current = null;
      });
    }
  };

  const handleTouchEnd = () => {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }

    if (touchStartY.current === null || touchCurrentY.current === null) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const diff = touchCurrentY.current - touchStartY.current;
    const threshold = 65; // Jarak geser piksel minimal

    if (diff < -threshold && currentIndex < items.length - 1) {
      // Geser ke atas -> Next Video
      const nextIndex = currentIndex + 1;
      const nextItem = items[nextIndex];
      isUserPausedRef.current = false;
      // Khusus di iOS: swipe bertindak sebagai user gesture resmi untuk mengaktifkan suara di video berikutnya
      if (isIOS && isMuted) {
        setIsMuted(false);
      }
      if (nextItem?.videoId) {
        loadedVideoIdRef.current = nextItem.videoId;
        sendIframeCommand('loadVideoById', [nextItem.videoId, 0]);
        sendIframeCommand('unMute');
        sendIframeCommand('setVolume', [100]);
      }
      setCurrentIndex(nextIndex);
      setIsTitleExpanded(false);
      setIsPaused(false);
      setIsPlaying(false);
      setAutoplayFailed(false);
      autoplayAttemptsRef.current = 0;
      markSwipedUp();
    } else if (diff > threshold && currentIndex > 0) {
      // Geser ke bawah -> Previous Video
      const prevIndex = currentIndex - 1;
      const prevItem = items[prevIndex];
      isUserPausedRef.current = false;
      if (isIOS && isMuted) {
        setIsMuted(false);
      }
      if (prevItem?.videoId) {
        loadedVideoIdRef.current = prevItem.videoId;
        sendIframeCommand('loadVideoById', [prevItem.videoId, 0]);
        sendIframeCommand('unMute');
        sendIframeCommand('setVolume', [100]);
      }
      setCurrentIndex(prevIndex);
      setIsTitleExpanded(false);
      setIsPaused(false);
      setIsPlaying(false);
      setAutoplayFailed(false);
      autoplayAttemptsRef.current = 0;
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

  const currentTitle = currentItem.title;
  const currentSpeaker = currentItem.speakerName;
  const currentPoster = currentItem.posterUrl || `https://i.ytimg.com/vi/${currentVideoId}/hqdefault.jpg`;

  return (
    <div
      className="fixed inset-0 z-40 bg-black text-white flex flex-col justify-between select-none overflow-hidden touch-none font-geist"
      style={{ contain: 'strict' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* AMBIENT BLURRED BACKDROP DARI POSTER VIDEO */}
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-35 scale-125 pointer-events-none transition-opacity duration-700"
        style={{
          backgroundImage: `url(${currentPoster})`,
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none z-1" />

      {/* TOP HEADER OVERLAY */}
      <header className="relative z-20 px-4 pt-[calc(10px+env(safe-area-inset-top,10px))] pb-2 flex items-center justify-between gap-2">
        {/* Indikator Status: 'Live' atau 'Rekaman' */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 shadow-lg">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              currentItem.isLive ? 'bg-red-600 animate-pulse' : 'bg-blue-500'
            }`}
          />
          <span className="text-xs font-bold tracking-wide">
            {currentItem.isLive ? 'Live' : 'Rekaman'}
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
            transform: `translate3d(0, ${dragOffset}px, 0)`,
            willChange: isDragging ? 'transform' : 'auto',
            transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          {/* VIDEO FRAME 16:9 TERPUSAT */}
          <div className="w-full max-w-lg aspect-video bg-black relative shadow-2xl overflow-hidden border-y border-white/10 sm:border sm:rounded-2xl">
            <iframe
              ref={activeIframeRef}
              src={`https://www.youtube.com/embed/${initialVideoId}?autoplay=1&mute=${isMuted ? 1 : 0}&enablejsapi=1&playsinline=1&controls=0&rel=0&modestbranding=1&origin=${typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : ''}`}
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
                  sendIframeCommand('playVideo');
                  if (!isMuted) {
                    sendIframeCommand('unMute');
                    sendIframeCommand('setVolume', [100]);
                  }
                } catch {}
              }}
            />

            {/* Tap to Unmute / Play-Pause Overlay Ala TikTok */}
            <div
              onClick={handleVideoAreaTap}
              className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center select-none"
              aria-label={isMuted ? 'Nyalakan Suara' : isPaused ? 'Putar Video' : 'Jeda Video'}
            >
              {/* Centered Frosted Play Icon saat di-Pause, atau jika Autoplay ditahan Browser khusus di iOS */}
              {(isPaused || (isIOS && autoplayFailed)) && (
                <div className="flex flex-col items-center gap-2 animate-in zoom-in-75 duration-200">
                  <div className="w-16 h-16 rounded-full bg-black/75 backdrop-blur-md text-white flex items-center justify-center shadow-2xl border border-white/25 active:scale-90 transition-transform">
                    <span className="material-symbols-outlined text-[38px] ml-1 text-white">play_arrow</span>
                  </div>
                  {isIOS && autoplayFailed && (
                    <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-white/90 text-[11px] font-semibold border border-white/15 shadow-lg">
                      Ketuk untuk Memutar
                    </span>
                  )}
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

          {!hasSwipedUp ? (
            <div className="flex items-center gap-1 text-white/70 font-medium animate-in fade-in duration-300">
              <span className="material-symbols-outlined text-[15px] animate-bounce text-red-500">
                swipe_vertical
              </span>
              <span>Geser ke atas</span>
            </div>
          ) : (
            <div className="text-[10px] text-white/40 tracking-wider font-medium">
              {currentIndex + 1} / {items.length}
            </div>
          )}

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

export default React.memo(MobileSwipeLiveViewer);

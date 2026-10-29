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
  onOpenStudyMode?: (stream: {
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

// Helper format detik menjadi MM:SS atau HH:MM:SS
function formatVideoTime(rawSeconds: number): string {
  if (!Number.isFinite(rawSeconds) || rawSeconds < 0) return '00:00';
  const totalSec = Math.floor(rawSeconds);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function MobileSwipeLiveViewer({
  items,
  initialIndex,
  isOpen,
  onClose,
  onSwitchToList,
  onPlayMiniPlayer,
  onOpenStudyMode,
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
  const [playbackError, setPlaybackError] = useState(false);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // State Timeline & Scrubber Interaktif (Gaya TikTok / YouTube Shorts)
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubTime, setScrubTime] = useState<number>(0);
  const isScrubbingRef = useRef<boolean>(false);
  const [skipFeedback, setSkipFeedback] = useState<'backward' | 'forward' | null>(null);
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' | 'center' }>({
    time: 0,
    side: 'center',
  });
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setPlaybackError(false);
    setCurrentTime(0);
    setDuration(0);
    setIsScrubbing(false);
    setScrubTime(0);
    isScrubbingRef.current = false;
    autoplayAttemptsRef.current = 0;
    isUserPausedRef.current = false;
  }, [currentIndex]);

  // Fungsi Seek ke detik tertentu pada video YouTube
  const handleSeekTo = useCallback(
    (targetSeconds: number) => {
      const clamped = Math.max(
        0,
        duration > 0 ? Math.min(duration, targetSeconds) : targetSeconds
      );
      setCurrentTime(clamped);
      setScrubTime(clamped);
      sendIframeCommand('seekTo', [clamped, true]);

      if (isPaused || !isPlaying) {
        isUserPausedRef.current = false;
        sendIframeCommand('playVideo');
        setIsPaused(false);
        setIsPlaying(true);
      }
    },
    [duration, isPaused, isPlaying, sendIframeCommand]
  );

  // Fungsi Lompat Cepat -10 detik / +10 detik dengan indikator visual ala YouTube Shorts
  const handleSkipSeconds = useCallback(
    (deltaSeconds: number) => {
      const baseTime = isScrubbingRef.current ? scrubTime : currentTime;
      handleSeekTo(baseTime + deltaSeconds);
      if (skipFeedbackTimerRef.current) {
        clearTimeout(skipFeedbackTimerRef.current);
      }
      setSkipFeedback(deltaSeconds < 0 ? 'backward' : 'forward');
      skipFeedbackTimerRef.current = setTimeout(() => {
        setSkipFeedback(null);
      }, 650);
    },
    [currentTime, scrubTime, handleSeekTo]
  );

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

  // Handler cerdas ketukan area video ala TikTok / YouTube Shorts:
  // - Double-tap sisi kiri (<38% lebar): mundur 10 detik (-10d)
  // - Double-tap sisi kanan (>62% lebar): maju 10 detik (+10d)
  // - Single-tap: nyalakan suara jika masih mute, atau toggle Play / Pause
  const handleVideoAreaTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isMuted) {
        handleUnmute();
        return;
      }

      if (!isPlaying || isPaused || (isIOS && autoplayFailed)) {
        isUserPausedRef.current = false;
        sendIframeCommand('playVideo');
        setIsPaused(false);
        setIsPlaying(true);
        setAutoplayFailed(false);
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const ratioX = rect.width > 0 ? relX / rect.width : 0.5;
      const tapSide: 'left' | 'right' | 'center' =
        ratioX < 0.38 ? 'left' : ratioX > 0.62 ? 'right' : 'center';

      const now = Date.now();
      const isDoubleTap =
        tapSide !== 'center' &&
        lastTapRef.current.side === tapSide &&
        now - lastTapRef.current.time < 280;

      if (isDoubleTap) {
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        lastTapRef.current = { time: 0, side: 'center' };
        handleSkipSeconds(tapSide === 'left' ? -10 : 10);
        return;
      }

      lastTapRef.current = { time: now, side: tapSide };

      if (tapSide === 'center') {
        togglePlayPause();
      } else {
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
        }
        singleTapTimerRef.current = setTimeout(() => {
          togglePlayPause();
          singleTapTimerRef.current = null;
        }, 230);
      }
    },
    [
      isMuted,
      isPlaying,
      isPaused,
      isIOS,
      autoplayFailed,
      handleUnmute,
      togglePlayPause,
      handleSkipSeconds,
      sendIframeCommand,
    ]
  );

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

        // Tangani event onError jika video disetel privat, dilarang di-embed, atau dihapus
        const isErrorEvent =
          data?.event === 'onError' ||
          typeof data?.info?.errorCode !== 'undefined' ||
          (data?.event === 'infoDelivery' && typeof data?.info?.errorCode !== 'undefined');

        if (isErrorEvent) {
          const rawCode = data?.data ?? data?.info?.errorCode ?? data?.info;
          const errCode = Number(rawCode);
          if (errCode === 100 || errCode === 101 || errCode === 150 || errCode === 2) {
            setPlaybackError(true);
            setIsPlaying(false);
            setIsPaused(true);
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

          if (
            typeof info.currentTime === 'number' &&
            !Number.isNaN(info.currentTime) &&
            !isScrubbingRef.current
          ) {
            setCurrentTime(info.currentTime);
          }

          if (
            typeof info.duration === 'number' &&
            !Number.isNaN(info.duration) &&
            info.duration > 0
          ) {
            setDuration(info.duration);
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
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('[data-no-swipe="true"]')
    ) {
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
  const displayTime = isScrubbing ? scrubTime : currentTime;
  const effectiveMaxDuration = duration > 0 ? duration : Math.max(60, Math.ceil(displayTime + 30));
  const progressPercent = effectiveMaxDuration > 0 ? Math.min(100, Math.max(0, (displayTime / effectiveMaxDuration) * 100)) : 0;

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

            {/* Overlay jika Video Private / Dilarang Embed */}
            {playbackError && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-950 text-center select-none space-y-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <span className="material-symbols-outlined text-[22px]">lock</span>
                </div>
                <div className="space-y-0.5 max-w-[90%]">
                  <p className="text-xs sm:text-sm font-bold text-white leading-tight">
                    Rekaman Diatur Privat oleh Saluran
                  </p>
                  <p className="text-[10px] text-white/70 line-clamp-2 leading-relaxed">
                    Saluran memprivat siaran ini untuk proses editing / rilis ulang rekaman resmi.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {currentIndex < items.length - 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToNext();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                      <span>Kajian Berikutnya</span>
                    </button>
                  )}
                  <a
                    href={`https://www.youtube.com/watch?v=${currentVideoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                    <span>YouTube</span>
                  </a>
                </div>
              </div>
            )}

            {/* Tap / Double-Tap Overlay Ala TikTok & YouTube Shorts */}
            <div
              onClick={handleVideoAreaTap}
              className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center select-none"
              aria-label={isMuted ? 'Nyalakan Suara' : isPaused ? 'Putar Video' : 'Jeda Video'}
            >
              {/* Indikator Animasi Double-Tap Skip Kiri (-10d) */}
              {skipFeedback === 'backward' && (
                <div className="absolute left-5 top-1/2 -translate-y-1/2 px-3.5 py-2 rounded-2xl bg-black/75 backdrop-blur-md border border-white/20 text-white flex flex-col items-center gap-0.5 shadow-2xl animate-in fade-in zoom-in-75 duration-150 pointer-events-none">
                  <span className="material-symbols-outlined text-[26px] text-emerald-400">
                    fast_rewind
                  </span>
                  <span className="text-[10px] font-bold tracking-wide">-10 detik</span>
                </div>
              )}

              {/* Indikator Animasi Double-Tap Skip Kanan (+10d) */}
              {skipFeedback === 'forward' && (
                <div className="absolute right-5 top-1/2 -translate-y-1/2 px-3.5 py-2 rounded-2xl bg-black/75 backdrop-blur-md border border-white/20 text-white flex flex-col items-center gap-0.5 shadow-2xl animate-in fade-in zoom-in-75 duration-150 pointer-events-none">
                  <span className="material-symbols-outlined text-[26px] text-emerald-400">
                    fast_forward
                  </span>
                  <span className="text-[10px] font-bold tracking-wide">+10 detik</span>
                </div>
              )}

              {/* Centered Frosted Controls saat di-Pause (-10d, Play, +10d) ala YouTube Shorts / TikTok */}
              {(isPaused || (isIOS && autoplayFailed)) && (
                <div className="flex flex-col items-center gap-2.5 animate-in zoom-in-75 duration-200">
                  <div className="flex items-center gap-5">
                    {/* Tombol Mundur 10 Detik saat Pause */}
                    <button
                      type="button"
                      data-no-swipe="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSkipSeconds(-10);
                      }}
                      className="w-11 h-11 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md text-white flex items-center justify-center shadow-xl border border-white/20 active:scale-90 transition-transform cursor-pointer"
                      aria-label="Mundur 10 detik"
                    >
                      <span className="material-symbols-outlined text-[22px]">replay_10</span>
                    </button>

                    {/* Tombol Play Utama */}
                    <div className="w-16 h-16 rounded-full bg-black/75 backdrop-blur-md text-white flex items-center justify-center shadow-2xl border border-white/25 active:scale-90 transition-transform">
                      <span className="material-symbols-outlined text-[38px] ml-1 text-white">
                        play_arrow
                      </span>
                    </div>

                    {/* Tombol Maju 10 Detik saat Pause */}
                    <button
                      type="button"
                      data-no-swipe="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSkipSeconds(10);
                      }}
                      className="w-11 h-11 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md text-white flex items-center justify-center shadow-xl border border-white/20 active:scale-90 transition-transform cursor-pointer"
                      aria-label="Maju 10 detik"
                    >
                      <span className="material-symbols-outlined text-[22px]">forward_10</span>
                    </button>
                  </div>

                  {/* Pill Durasi Ringkas saat Dijeda atau Info Ketuk iOS */}
                  {isIOS && autoplayFailed ? (
                    <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-white/90 text-[11px] font-semibold border border-white/15 shadow-lg">
                      Ketuk untuk Memutar
                    </span>
                  ) : (
                    duration > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-white/90 text-[11px] font-mono font-semibold border border-white/15 shadow-lg tabular-nums">
                        {formatVideoTime(displayTime)} / {formatVideoTime(duration)}
                      </span>
                    )
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
        <aside
          className={`absolute right-3.5 bottom-28 z-30 flex flex-col items-center gap-4 transition-opacity duration-150 ${
            isScrubbing ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
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

          {/* Tombol Mode Belajar & Catat Faidah */}
          {onOpenStudyMode && (
            <button
              type="button"
              onClick={() => {
                onOpenStudyMode({
                  videoId: currentVideoId,
                  title: currentTitle,
                  channelName: currentItem.channelName,
                  speakerName: currentSpeaker,
                });
              }}
              className="w-11 h-11 rounded-full bg-emerald-600/85 hover:bg-emerald-600 border border-emerald-400/50 text-white flex flex-col items-center justify-center transition-all cursor-pointer shadow-xl backdrop-blur-md active:scale-90"
              title="Mode Belajar: Catat & Coret-Coret Faidah Kajian"
            >
              <span className="material-symbols-outlined text-[20px]">edit_note</span>
            </button>
          )}

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

      {/* BOTTOM OVERLAY INFO, SWIPE HINT & TIKTOK/SHORTS EDGE-TO-EDGE TIMELINE SCRUBBER */}
      <footer className="relative z-20 px-4 pb-[calc(68px+env(safe-area-inset-bottom,12px))] pt-2 flex flex-col gap-1.5 bg-gradient-to-t from-black via-black/85 to-transparent">
        {/* Saat Scrubbing Aktif: Tampilkan HUD Angka Waktu Besar di Tengah Bawah ala TikTok / Shorts */}
        {isScrubbing && (
          <div className="absolute inset-x-0 bottom-[calc(86px+env(safe-area-inset-bottom,12px))] z-30 flex items-center justify-center pointer-events-none animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-2 rounded-2xl bg-black/80 backdrop-blur-md border border-white/15 shadow-2xl flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-xl font-extrabold text-white tracking-tight">
                {formatVideoTime(scrubTime)}
              </span>
              {duration > 0 && (
                <>
                  <span className="text-sm text-white/40 font-bold">/</span>
                  <span className="text-base font-semibold text-white/60">
                    {formatVideoTime(duration)}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Info Pemateri & Channel (Otomatis fade-out saat pengguna menggeser timeline seperti TikTok) */}
        <div
          className={`pr-16 flex flex-col gap-1 transition-opacity duration-150 ${
            isScrubbing ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
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
              <span className="text-[10px] text-white/60">• {currentItem.timeText}</span>
            )}
          </div>

          <p className="text-xs font-semibold text-amber-300 truncate">{currentSpeaker}</p>

          <p
            onClick={() => setIsTitleExpanded(!isTitleExpanded)}
            className={`text-xs text-white/90 leading-snug cursor-pointer transition-all ${
              isTitleExpanded ? 'line-clamp-none' : 'line-clamp-2'
            }`}
          >
            {currentTitle}
          </p>

          {!hasSwipedUp && items.length > 1 && (
            <div className="pt-1 flex items-center gap-1 text-[11px] text-white/60 font-medium animate-in fade-in duration-300">
              <span className="material-symbols-outlined text-[14px] animate-bounce text-red-500">
                swipe_vertical
              </span>
              <span>Geser ke atas untuk kajian berikutnya</span>
            </div>
          )}
        </div>

        {/* GARIS TIMELINE EDGE-TO-EDGE DI BATAS BAWAH (TEPAT DI ATAS BOTTOM NAV ALA TIKTOK / YOUTUBE SHORTS) */}
        {!playbackError && (
          <div
            data-no-swipe="true"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className="relative -mx-4 h-6 flex items-center select-none z-30"
          >
            {/* Visual Track Background (Tipis 3px saat idle, menebal 8px saat digeser jari) */}
            <div
              className={`w-full bg-white/25 overflow-hidden transition-all duration-150 ${
                isScrubbing ? 'h-2 bg-white/35' : 'h-[3px]'
              }`}
            >
              <div
                className={`h-full transition-[width] duration-75 ${
                  isScrubbing ? 'bg-red-500' : 'bg-white/90'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Visual Thumb Dot (Kecil saat idle, membesar saat digeser atau dijeda) */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full pointer-events-none transition-all duration-150 ${
                isScrubbing
                  ? 'w-4 h-4 bg-red-500 border-2 border-white shadow-[0_0_12px_rgba(239,68,68,0.9)] scale-110'
                  : isPaused
                    ? 'w-2.5 h-2.5 bg-white shadow-md'
                    : 'w-1.5 h-1.5 bg-white/90'
              }`}
              style={{ left: `${progressPercent}%` }}
            />

            {/* Native Range Input dengan Area Sentuh Lebar (24px tinggi) */}
            <input
              type="range"
              min={0}
              max={effectiveMaxDuration}
              step={1}
              value={Math.min(effectiveMaxDuration, Math.max(0, Math.floor(displayTime)))}
              aria-label="Geser Timeline Video"
              onPointerDown={() => {
                isScrubbingRef.current = true;
                setIsScrubbing(true);
                setScrubTime(currentTime);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                isScrubbingRef.current = true;
                setIsScrubbing(true);
                setScrubTime(currentTime);
              }}
              onChange={(e) => {
                const nextVal = Number(e.target.value);
                if (!isScrubbingRef.current) {
                  isScrubbingRef.current = true;
                  setIsScrubbing(true);
                }
                setScrubTime(nextVal);
              }}
              onPointerUp={(e) => {
                const finalVal = Number((e.target as HTMLInputElement).value);
                isScrubbingRef.current = false;
                setIsScrubbing(false);
                handleSeekTo(finalVal);
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                isScrubbingRef.current = false;
                setIsScrubbing(false);
                handleSeekTo(scrubTime);
              }}
              onKeyUp={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  isScrubbingRef.current = false;
                  setIsScrubbing(false);
                  handleSeekTo(scrubTime);
                }
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 m-0"
            />
          </div>
        )}
      </footer>
    </div>
  );
}

export default React.memo(MobileSwipeLiveViewer);

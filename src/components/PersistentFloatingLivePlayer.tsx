'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useLivePlayer } from '@/context/LivePlayerContext';
import { triggerLoginNudge } from '@/components/LoginNudgePrompt';
import { createClient } from '@/utils/supabase/client';
import { FEATURE_FLAGS } from '@/config/features';

export default function PersistentFloatingLivePlayer() {
  const {
    activeStream,
    isOpen,
    isMinimized,
    isModalExpanded,
    isPipActive,
    initialResumeTime,
    closePlayer,
    toggleMinimize,
    maximizePlayer,
    minimizePlayer,
    expandToModal,
    collapseModal,
    setIsPipActive,
    updateStoredPlaybackTime,
    openStudyMode,
    isStudyModeOpen,
    isStudyNotesOpen,
    toggleMinimizeStudyNotes,
  } = useLivePlayer();

  const pathname = usePathname();
  const isPipRoute = pathname === '/live/pip' || pathname?.startsWith('/live/pip');

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [playerWidth, setPlayerWidth] = useState<number>(360);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [activeCorner, setActiveCorner] = useState<'top-left' | 'bottom-left' | 'bottom-right' | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [resumeTime, setResumeTime] = useState<number>(0);
  const [isPlayerMuted, setIsPlayerMuted] = useState(false);
  const currentPlaybackTimeRef = useRef<number>(0);
  const playbackStartEpochRef = useRef<number>(Date.now());
  const lastStorageSyncRef = useRef<number>(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pipWindowRef = useRef<Window | null>(null);

  // Helper untuk membuka suara (unMute) & memastikan pemutaran video aktif
  const sendUnmuteMiniPlayer = useCallback(() => {
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
        setIsPlayerMuted(false);
      }
    } catch {}
  }, []);
  const pipCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    initialLeft: number;
    initialTop: number;
  } | null>(null);
  const resizeStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    initialWidth: number;
    initialLeft: number;
    initialTop: number;
    corner: 'top-left' | 'bottom-left' | 'bottom-right';
  } | null>(null);

  // Muat ukuran lebar tersimpan dari localStorage saat awal dibuka
  useEffect(() => {
    try {
      const saved = localStorage.getItem('peta_kajian_live_player_width');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 260 && val <= 720) {
          const maxAllowed = typeof window !== 'undefined' ? Math.min(val, window.innerWidth - 24) : val;
          setPlayerWidth(Math.max(260, maxAllowed));
        }
      }
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
  }, []);

  // Helper untuk membatasi posisi agar tidak keluar dari viewport layar
  const clampPosition = useCallback(
    (x: number, y: number, customWidth?: number) => {
      if (typeof window === 'undefined') return { x, y };
      const rect = containerRef.current?.getBoundingClientRect();
      const width = customWidth || (isMinimized ? 280 : playerWidth) || rect?.width || 360;
      const height = isMinimized ? 48 : width * (9 / 16) + 90;

      const padding = 12;
      // Beri ruang ekstra 72px di mobile agar tidak menutupi bottom navigation bar jika digeser ke bawah
      const isMobile = window.innerWidth < 768;
      const bottomPadding = isMobile ? 72 : 16;

      const minX = padding;
      const maxX = Math.max(padding, window.innerWidth - width - padding);
      const minY = padding;
      const maxY = Math.max(padding, window.innerHeight - height - bottomPadding);

      return {
        x: Math.min(Math.max(x, minX), maxX),
        y: Math.min(Math.max(y, minY), maxY),
      };
    },
    [isMinimized, playerWidth]
  );

  // Tutup modal (kembali ke mini player) saat tombol ESC ditekan
  useEffect(() => {
    if (!isModalExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        collapseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalExpanded, collapseModal]);

  // Handler Pointer Drag
  const handlePointerDown = (e: React.PointerEvent) => {
    // Abaikan jika sedang dalam mode modal layar penuh
    if (isModalExpanded) return;

    // Hanya proses sentuhan atau klik tombol utama mouse
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
    };

    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Abaikan jika pointer capture tidak didukung browser tertentu
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.pointerX;
    const deltaY = e.clientY - dragStartRef.current.pointerY;

    const newX = dragStartRef.current.initialLeft + deltaX;
    const newY = dragStartRef.current.initialTop + deltaY;

    setPosition(clampPosition(newX, newY));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    dragStartRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Abaikan
    }
  };

  // Handler Pointer Resize Bebas (Free Resize)
  const handleResizeDown = (
    e: React.PointerEvent,
    corner: 'top-left' | 'bottom-left' | 'bottom-right'
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    // Jika posisi belum pernah di-drag (masih default bottom-right CSS anchor),
    // ubah ke posisi koordinat absolut sekarang agar tidak melompat saat ditarik
    const currentPos = position || { x: rect.left, y: rect.top };
    if (!position) {
      setPosition(currentPos);
    }

    resizeStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialWidth: playerWidth,
      initialLeft: currentPos.x,
      initialTop: currentPos.y,
      corner,
    };

    setIsResizing(true);
    setActiveCorner(corner);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Abaikan
    }
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!isResizing || !resizeStartRef.current) return;

    const { pointerX, initialWidth, initialLeft, initialTop, corner } = resizeStartRef.current;
    const deltaX = e.clientX - pointerX;

    const minW = Math.min(260, window.innerWidth - 24);
    const maxW = Math.min(640, window.innerWidth - 24);

    let targetWidth = initialWidth;
    let newX = initialLeft;
    let newY = initialTop;

    if (corner === 'top-left') {
      // Tarik ke arah kiri-atas (deltaX negatif) = memperbesar card
      targetWidth = Math.min(Math.max(initialWidth - deltaX, minW), maxW);
      const diffW = targetWidth - initialWidth;
      const diffH = diffW * (9 / 16);
      newX = initialLeft - diffW;
      newY = initialTop - diffH;
    } else if (corner === 'bottom-left') {
      targetWidth = Math.min(Math.max(initialWidth - deltaX, minW), maxW);
      const diffW = targetWidth - initialWidth;
      newX = initialLeft - diffW;
      newY = initialTop;
    } else if (corner === 'bottom-right') {
      targetWidth = Math.min(Math.max(initialWidth + deltaX, minW), maxW);
      newX = initialLeft;
      newY = initialTop;
    }

    const roundedWidth = Math.round(targetWidth);
    setPlayerWidth(roundedWidth);
    setPosition(clampPosition(newX, newY, roundedWidth));
  };

  const handleResizeUp = (e: React.PointerEvent) => {
    if (!isResizing) return;
    setIsResizing(false);
    setActiveCorner(null);
    resizeStartRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Abaikan
    }
  };

  // Simpan preferensi lebar player ke localStorage setiap kali selesai resize
  useEffect(() => {
    if (!isResizing && playerWidth) {
      try {
        localStorage.setItem('peta_kajian_live_player_width', playerWidth.toString());
      } catch {
        // Abaikan jika localStorage tidak tersedia
      }
    }
  }, [playerWidth, isResizing]);

  // Re-clamp posisi saat mode diminimalkan/dibesarkan
  useEffect(() => {
    if (position) {
      setPosition((prev) => (prev ? clampPosition(prev.x, prev.y) : null));
    }
  }, [isMinimized, clampPosition]);

  // Re-clamp saat ukuran layar jendela diubah / rotate device
  useEffect(() => {
    const handleResize = () => {
      setPlayerWidth((prev) => Math.min(prev, window.innerWidth - 24));
      setPosition((prev) => (prev ? clampPosition(prev.x, prev.y) : null));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  // Pantau status autentikasi user untuk gating fitur Picture-in-Picture
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUser(data.user);
      } else {
        supabase.auth.getSession().then(({ data: sess }) => {
          if (sess?.session?.user) {
            setCurrentUser(sess.session.user);
          } else {
            setCurrentUser(null);
          }
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Inisialisasi & sinkronkan resumeTime saat sesi dipulihkan dari sessionStorage
  useEffect(() => {
    if (initialResumeTime > 0) {
      currentPlaybackTimeRef.current = initialResumeTime;
      setResumeTime(initialResumeTime);
    }
  }, [initialResumeTime]);

  // Reset timestamp playback saat video berganti
  useEffect(() => {
    if (activeStream?.videoId) {
      playbackStartEpochRef.current = Date.now();
      if (initialResumeTime > 0) {
        currentPlaybackTimeRef.current = initialResumeTime;
        setResumeTime(initialResumeTime);
      } else {
        currentPlaybackTimeRef.current = 0;
        setResumeTime(0);
      }
    }
  }, [activeStream?.videoId, initialResumeTime]);

  // Handshake berkala ke YouTube iframe agar secara kontinu mengirimkan telemetry infoDelivery (termasuk saat user seek)
  useEffect(() => {
    if (isPipRoute || !isOpen || isPipActive) return;

    const interval = setInterval(() => {
      try {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
            '*'
          );
        }
      } catch {}
    }, 600);

    return () => clearInterval(interval);
  }, [isPipRoute, isOpen, isPipActive]);

  // Helper penanganan ketika jendela PiP ditutup / dikembalikan ke tab web
  const handlePipClosedEvent = useCallback((time?: number) => {
    setIsPipActive(false);
    maximizePlayer();

    let resolvedTime = time;
    if (typeof resolvedTime !== 'number' || resolvedTime <= 0) {
      if (activeStream?.videoId) {
        try {
          const saved = localStorage.getItem(`peta_kajian_pip_time_${activeStream.videoId}`);
          if (saved) {
            const parsed = parseInt(saved, 10);
            if (!isNaN(parsed) && parsed > 0) resolvedTime = parsed;
          }
        } catch {}
      }
    }

    if (typeof resolvedTime === 'number' && resolvedTime > 0) {
      currentPlaybackTimeRef.current = resolvedTime;
      setResumeTime(resolvedTime);
      playbackStartEpochRef.current = Date.now();
    }

    try {
      if (iframeRef.current?.contentWindow) {
        if (typeof resolvedTime === 'number' && resolvedTime > 0) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'seekTo', args: [resolvedTime, true] }),
            '*'
          );
        }
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
          '*'
        );
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
          '*'
        );
      }
    } catch {}

    if (pipCheckIntervalRef.current) {
      clearInterval(pipCheckIntervalRef.current);
      pipCheckIntervalRef.current = null;
    }
    pipWindowRef.current = null;
  }, [activeStream?.videoId, setIsPipActive, maximizePlayer]);

  // Sinkronisasi status & timestamp PiP dengan jendela pop-out / Document PiP
  useEffect(() => {
    let broadcast: BroadcastChannel | null = null;

    try {
      broadcast = new BroadcastChannel('peta_kajian_pip_channel');
      broadcast.onmessage = (event) => {
        if (event.data?.type === 'PIP_CLOSED' || event.data?.type === 'PIP_PULL_BACK') {
          try {
            window.focus();
          } catch {}
          handlePipClosedEvent(event.data?.currentTime);
        } else if (event.data?.type === 'PIP_OPENED') {
          setIsPipActive(true);
        }
      };
    } catch {
      // Fallback ditangani oleh interval polling
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'PIP_CLOSED' || e.data?.type === 'PIP_PULL_BACK') {
        try {
          window.focus();
        } catch {}
        handlePipClosedEvent(e.data?.currentTime);
      } else {
        // Pantau update status pemutaran, mute, dan waktu langsung dari iframe YouTube (postMessage API)
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;

          // Tangani event onReady dari YouTube widget -> segera picu playVideo
          if (data?.event === 'onReady') {
            try {
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
                '*'
              );
              setTimeout(() => {
                iframeRef.current?.contentWindow?.postMessage(
                  JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
                  '*'
                );
              }, 350);
            } catch {}
          }

          // Sinkronkan status muted dari YouTube player
          if (typeof data?.info?.muted === 'boolean') {
            setIsPlayerMuted(data.info.muted);
          }

          const playerState = data?.info?.playerState;
          if (playerState === 5 || playerState === -1 || playerState === 2) {
            try {
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
                '*'
              );
            } catch {}
          }

          const time = data?.info?.currentTime ?? data?.currentTime;
          if (typeof time === 'number' && !isNaN(time)) {
            const roundedTime = Math.floor(time);
            currentPlaybackTimeRef.current = roundedTime;
            // Sinkronkan berkala ke sessionStorage setiap 1,5 detik
            const now = Date.now();
            if (now - lastStorageSyncRef.current > 1500) {
              lastStorageSyncRef.current = now;
              updateStoredPlaybackTime(roundedTime);
            }
          }
        } catch {}
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      try {
        broadcast?.close();
      } catch {}
      if (pipCheckIntervalRef.current) clearInterval(pipCheckIntervalRef.current);
    };
  }, [setIsPipActive, handlePipClosedEvent, updateStoredPlaybackTime]);

  // Simpan playback time secara presisi saat pengguna berpindah halaman / redirect ke Google OAuth
  useEffect(() => {
    const handleFlushTime = () => {
      if (currentPlaybackTimeRef.current > 0) {
        updateStoredPlaybackTime(currentPlaybackTimeRef.current);
      }
    };

    window.addEventListener('pagehide', handleFlushTime);
    window.addEventListener('beforeunload', handleFlushTime);
    return () => {
      window.removeEventListener('pagehide', handleFlushTime);
      window.removeEventListener('beforeunload', handleFlushTime);
    };
  }, [updateStoredPlaybackTime]);

  // Penanganan background playback & instant auto-resume saat berpindah tab atau jendela (terutama di mobile)
  useEffect(() => {
    if (isPipRoute || !isOpen || !activeStream || isPipActive) return;

    const handleVisibilityResume = () => {
      if (document.visibilityState === 'visible' || !document.hidden) {
        try {
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
            '*'
          );
        } catch {}
      } else {
        // Coba pertahankan pemutaran saat tab disembunyikan
        try {
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
            '*'
          );
        } catch {}
      }
    };

    const handleFocusResume = () => {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
          '*'
        );
      } catch {}
    };

    document.addEventListener('visibilitychange', handleVisibilityResume);
    window.addEventListener('focus', handleFocusResume);
    window.addEventListener('blur', handleVisibilityResume);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityResume);
      window.removeEventListener('focus', handleFocusResume);
      window.removeEventListener('blur', handleVisibilityResume);
    };
  }, [isPipRoute, isOpen, activeStream, isPipActive]);

  // Handler Kembalikan Video dari Jendela PiP ke Mini Player Tab Ini
  const handleRestoreFromPip = useCallback(() => {
    try {
      window.focus();
    } catch {}

    try {
      const broadcast = new BroadcastChannel('peta_kajian_pip_channel');
      broadcast.postMessage({ type: 'PIP_PULL_BACK' });
      broadcast.close();
    } catch {}

    try {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
      }
    } catch {}

    pipWindowRef.current = null;
    if (pipCheckIntervalRef.current) {
      clearInterval(pipCheckIntervalRef.current);
      pipCheckIntervalRef.current = null;
    }
    handlePipClosedEvent();
  }, [handlePipClosedEvent]);

  // Handler Buka / Kembalikan Jendela PiP (Document PiP Always-on-Top seperti TikTok)
  const handleTogglePip = useCallback(async () => {
    if (!activeStream) return;

    // PiP OS tidak didukung / dinonaktifkan di perangkat mobile (hp sudah memiliki PiP bawaan OS)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return;
    }

    // Jika PiP sedang aktif, klik tombol ini akan mengembalikan player ke tab web ini
    if (isPipActive) {
      handleRestoreFromPip();
      return;
    }

    // 1. Gating Login: Jika belum login, picu modal ajakan login
    if (!currentUser) {
      triggerLoginNudge({ type: 'pip', title: activeStream.title });
      return;
    }

    // 2. Baca detik pemutaran terakhir secara presisi (termasuk jika user baru saja memindahkan durasi / seek)
    let currentTimestamp = currentPlaybackTimeRef.current;
    if (!currentTimestamp && resumeTime > 0) {
      currentTimestamp = resumeTime;
    }

    // 3. Tentukan ukuran & URL
    const width = Math.max(380, Math.min(640, playerWidth));
    const height = Math.round(width * (9 / 16)) + 44;
    const url = `/live/pip?v=${activeStream.videoId}&t=${currentTimestamp}&title=${encodeURIComponent(activeStream.title)}&channel=${encodeURIComponent(activeStream.channelName)}&speaker=${encodeURIComponent(activeStream.speakerName || '')}`;

    // Minimalkan player di jendela utama dan jeda audio di tab ini agar tidak bentrok suara ganda (double audio)
    minimizePlayer();
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
          '*'
        );
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'mute', args: [] }),
          '*'
        );
      }
    } catch {}

    // PRIORITAS 1: Modern Document Picture-in-Picture API (Standar Chrome 116+ / Edge 116+)
    // Memberikan perilaku OS Always-on-Top (Topmost) persis seperti TikTok & YouTube!
    if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
      try {
        const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
          width,
          height,
        });

        pipWindowRef.current = pipWindow;
        setIsPipActive(true);

        try {
          pipWindow.focus();
        } catch {}

        // Styling body Document PiP
        pipWindow.document.title = activeStream.title;
        pipWindow.document.body.style.margin = '0';
        pipWindow.document.body.style.padding = '0';
        pipWindow.document.body.style.overflow = 'hidden';
        pipWindow.document.body.style.backgroundColor = '#000000';

        const iframe = pipWindow.document.createElement('iframe');
        iframe.src = url;
        iframe.style.position = 'absolute';
        iframe.style.inset = '0';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.display = 'block';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';

        pipWindow.document.body.appendChild(iframe);

        // Langsung fokuskan iframe ketika selesai dimuat
        iframe.addEventListener('load', () => {
          try {
            iframe.contentWindow?.focus();
          } catch {}
        });

        // Teruskan klik atau interaksi apapun pada jendela PiP untuk mengaktifkan audio & autoplay
        const forwardInteraction = () => {
          try {
            iframe.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
              '*'
            );
            iframe.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
              '*'
            );
          } catch {}
        };
        pipWindow.addEventListener('pointerdown', forwardInteraction, { once: true });
        pipWindow.addEventListener('click', forwardInteraction, { once: true });

        // Tangani penutupan jendela PiP (baik melalui tombol bawaan OS 'Back to tab' maupun tombol X)
        pipWindow.addEventListener(
          'pagehide',
          () => {
            try {
              window.focus();
            } catch {}
            let lastTime: number | undefined;
            try {
              const saved = localStorage.getItem(`peta_kajian_pip_time_${activeStream.videoId}`);
              if (saved) lastTime = parseInt(saved, 10);
            } catch {}
            handlePipClosedEvent(lastTime);
          },
          { once: true }
        );

        return;
      } catch (err) {
        console.warn('Document Picture-in-Picture gagal dibuka, fallback ke popup:', err);
      }
    }

    // PRIORITAS 2: Fallback ke window.open popup (untuk browser yang belum mendukung Document PiP seperti Firefox)
    const popup = window.open(
      url,
      'peta_kajian_pip_window',
      `popup=yes,width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      alert('Jendela pop-out diblokir oleh browser. Harap izinkan pop-up untuk situs ini.');
      return;
    }

    pipWindowRef.current = popup;
    setIsPipActive(true);

    // Pantau secara berkala apakah jendela PiP ditutup oleh user
    if (pipCheckIntervalRef.current) clearInterval(pipCheckIntervalRef.current);
    pipCheckIntervalRef.current = setInterval(() => {
      if (!pipWindowRef.current || pipWindowRef.current.closed) {
        if (pipCheckIntervalRef.current) {
          clearInterval(pipCheckIntervalRef.current);
          pipCheckIntervalRef.current = null;
        }
        pipWindowRef.current = null;
        let lastTime: number | undefined;
        try {
          const saved = localStorage.getItem(`peta_kajian_pip_time_${activeStream.videoId}`);
          if (saved) lastTime = parseInt(saved, 10);
        } catch {}
        try {
          window.focus();
        } catch {}
        handlePipClosedEvent(lastTime);
      }
    }, 400);
  }, [activeStream, currentUser, isPipActive, playerWidth, resumeTime, handlePipClosedEvent, handleRestoreFromPip, minimizePlayer]);

  // Handler Tutup Pemutar & Tutup PiP jika terbuka
  const handleClosePlayer = useCallback(() => {
    try {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
      }
    } catch {}
    pipWindowRef.current = null;
    if (pipCheckIntervalRef.current) {
      clearInterval(pipCheckIntervalRef.current);
      pipCheckIntervalRef.current = null;
    }
    closePlayer();
  }, [closePlayer]);

  if (isPipRoute || !isOpen || !activeStream) {
    return null;
  }

  return (
    <>
      {/* 
        Overlay transparan saat proses drag atau resize aktif 
        Mencegah mouse event tersangkut / tertelan ke dalam YouTube iframe 
      */}
      {(isDragging || isResizing) && (
        <div 
          className={`fixed inset-0 z-[60] select-none ${
            isResizing
              ? activeCorner === 'bottom-left'
                ? 'cursor-nesw-resize'
                : 'cursor-nwse-resize'
              : 'cursor-move'
          }`}
          style={{ touchAction: 'none' }}
        />
      )}

      <div 
        ref={containerRef}
        onClick={(e) => {
          if (isModalExpanded && e.target === e.currentTarget) {
            collapseModal();
          }
        }}
        style={
          isModalExpanded
            ? undefined
            : {
                width: isMinimized ? undefined : `${playerWidth}px`,
                ...(position ? {
                  position: 'fixed',
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  right: 'auto',
                  bottom: 'auto',
                  zIndex: 50,
                } : {}),
              }
        }
        className={
          isModalExpanded
            ? "fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
            : `fixed z-50 max-w-[calc(100vw-24px)] ${
                isResizing ? 'transition-none select-none' : 'transition-shadow duration-200'
              } ${
                !position ? 'bottom-[72px] md:bottom-4 right-3 sm:right-4' : ''
              } ${isDragging || isResizing ? 'shadow-2xl scale-[1.01]' : ''}`
        }
      >
        {/* 
          PENTING: Iframe YouTube harus selalu berada di DOM 
          agar audio tetap berputar kontinu tanpa restart saat minimize/maximize.
        */}
        {/* 
          1. MODE MINIMIZED / COMPACT AUDIO BAR (DRAGGABLE)
          Dirender saat isMinimized === true dan tidak dalam mode modal diperbesar. 
        */}
        {isMinimized && !isModalExpanded && (
          <div 
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ touchAction: 'none' }}
            className="h-12 px-3.5 rounded-full bg-surface-container-lowest/95 dark:bg-neutral-900/95 backdrop-blur-md border border-red-500/30 dark:border-red-500/40 hover:border-red-500/70 shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-2 duration-200 cursor-move hover:bg-surface-container-low transition-colors select-none"
            title="Klik dan tahan untuk menggeser posisi bar audio"
          >
            {/* Audio Visualizer / PiP Indicator */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isPipActive ? (
                <div className="flex items-center gap-1 text-indigo-500 dark:text-indigo-400">
                  <span className="material-symbols-outlined text-[18px] animate-pulse">picture_in_picture_alt</span>
                </div>
              ) : isPlayerMuted ? (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={sendUnmuteMiniPlayer}
                  className="flex items-center gap-1 text-amber-500 hover:text-amber-400 text-[11px] font-bold cursor-pointer"
                  title="Klik untuk menyalakan suara"
                >
                  <span className="material-symbols-outlined text-[18px] animate-pulse">volume_off</span>
                </button>
              ) : (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
                  </span>
                  {/* Animasi Batang Equalizer */}
                  <div className="flex items-end gap-0.5 h-3.5 px-0.5">
                    <span className="w-0.5 bg-red-500 rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-2.5" />
                    <span className="w-0.5 bg-red-500 rounded-full animate-[pulse_1.2s_ease-in-out_infinite] h-3.5" />
                    <span className="w-0.5 bg-red-500 rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-2" />
                  </div>
                </>
              )}
            </div>

            {/* Teks Channel & Judul Ringkas */}
            <div className="min-w-0 max-w-[170px] sm:max-w-[220px]">
              <p className={`text-[11px] font-bold truncate leading-tight ${isPipActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-on-surface'}`}>
                {isPipActive ? 'Aktif di Jendela PiP' : activeStream.channelName}
              </p>
              <p className="text-[10px] text-outline truncate leading-tight">
                {activeStream.title}
              </p>
            </div>

            {/* Kontrol Kanan (Mencegah drag saat tombol diklik) */}
            <div 
              className="flex items-center gap-1 shrink-0 ml-1"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Tombol Catatan Faidah dari Bar Audio */}
              <button
                type="button"
                onClick={() => {
                  if (isStudyNotesOpen) {
                    toggleMinimizeStudyNotes();
                  } else {
                    openStudyMode({
                      videoId: activeStream.videoId,
                      title: activeStream.title,
                      speakerName: activeStream.speakerName,
                      channelName: activeStream.channelName,
                    });
                  }
                }}
                className={`${
                  FEATURE_FLAGS.ENABLE_MOBILE_STUDY_NOTES ? 'flex' : 'hidden md:flex'
                } w-7 h-7 rounded-full items-center justify-center transition-colors cursor-pointer ${
                  isStudyNotesOpen
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 font-bold'
                    : 'text-outline hover:text-emerald-600 hover:bg-surface-container'
                }`}
                title={isStudyNotesOpen ? 'Sembunyikan / Tampilkan Catatan' : 'Buka Catatan Faidah (Sticky Note)'}
                aria-label="Catatan Faidah"
              >
                <span className="material-symbols-outlined text-[15px]">edit_note</span>
              </button>

              {/* Tombol PiP OS (Pop-out di Luar Browser - Hanya Desktop) */}
              <button
                type="button"
                onClick={handleTogglePip}
                className={`hidden md:flex items-center justify-center transition-colors cursor-pointer p-1 ${
                  isPipActive
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-outline hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
                title={
                  isPipActive
                    ? 'Kembalikan Pemutar ke Tab Ini'
                    : currentUser
                    ? 'Buka Jendela Mini Melayang (Pop-out PiP)'
                    : 'Buka Jendela Mini Melayang (Khusus Pengguna Masuk)'
                }
                aria-label="Picture in Picture OS"
              >
                <span className="material-symbols-outlined text-[18px]">picture_in_picture_alt</span>
              </button>

              <button
                type="button"
                onClick={maximizePlayer}
                className="w-7 h-7 rounded-full bg-surface-container hover:bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                title="Perbesar Tampilan Video"
                aria-label="Perbesar Video"
              >
                <span className="material-symbols-outlined text-[16px]">expand_less</span>
              </button>

              {/* Tombol Maximize ke Modal Layar Penuh dari Bar Audio */}
              <button
                type="button"
                onClick={expandToModal}
                className="w-7 h-7 rounded-full bg-surface-container hover:bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                title="Perbesar Penuh (Modal)"
                aria-label="Perbesar Penuh"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_full</span>
              </button>

              <button
                type="button"
                onClick={handleClosePlayer}
                className="w-7 h-7 rounded-full hover:bg-surface-container text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                title="Tutup Player"
                aria-label="Tutup Player"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </div>
        )}

        {/* 
          2. WADAH CARD UTAMA DENGAN SINGLE PERSISTENT IFRAME
          PENTING: Iframe ini tidak pernah di-unmount saat minimize/maximize.
          Ketika isMinimized === true, wadah ini diposisikan di latar belakang dengan opacity-0,
          sehingga audio YouTube tetap berputar kontinu tanpa henti dan tanpa kena blokir autoplay.
        */}
        <div 
          className={
            isMinimized && !isModalExpanded
              ? "absolute bottom-0 right-0 w-[240px] h-[135px] opacity-0 pointer-events-none -z-50 overflow-hidden"
              : isModalExpanded
              ? "bg-surface-container-lowest rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col border border-surface-container-high animate-in zoom-in-95 duration-200 max-h-[92vh]"
              : "relative w-full rounded-2xl bg-surface-container-lowest/95 dark:bg-neutral-900/95 backdrop-blur-md border border-surface-container-high/80 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300"
          }
        >
          {isModalExpanded ? (
            /* Modal Header Layar Penuh */
            <div className="px-3.5 sm:px-4 py-2.5 sm:py-3 bg-surface-container flex items-center justify-between gap-3 border-b border-surface-container-high select-none">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-red-600 text-white shrink-0">
                  LIVE
                </span>
                <h3 className="font-bold text-xs sm:text-base text-on-surface truncate">
                  {activeStream.title}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Tombol Perkecil ke Mini Player */}
                <button
                  type="button"
                  onClick={collapseModal}
                  className="w-8 h-8 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-outline hover:text-on-surface transition-colors shrink-0 cursor-pointer"
                  title="Kecilkan ke Mini Player"
                  aria-label="Kecilkan ke Mini Player"
                >
                  <span className="material-symbols-outlined text-[19px]">close_fullscreen</span>
                </button>
                {/* Tombol Tutup Pemutar */}
                <button
                  type="button"
                  onClick={handleClosePlayer}
                  className="w-8 h-8 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-outline hover:text-red-500 transition-colors shrink-0 cursor-pointer"
                  title="Tutup Pemutar"
                  aria-label="Tutup Pemutar"
                >
                  <span className="material-symbols-outlined text-[19px]">close</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* HUD Dimensi Realtime saat Resize */}
              {isResizing && (
                <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all animate-in fade-in duration-150">
                  <div className="px-3.5 py-1.5 rounded-full bg-neutral-900/95 text-white text-xs font-mono font-medium shadow-2xl border border-white/20 flex items-center gap-1.5 tracking-wide">
                    <span className="material-symbols-outlined text-[15px] text-primary">aspect_ratio</span>
                    <span>{playerWidth} × {Math.round(playerWidth * 9 / 16)} px</span>
                  </div>
                </div>
              )}

              {/* Header Card sebagai Pegangan Drag (Handle) */}
              <div 
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ touchAction: 'none' }}
                className="px-3.5 py-2.5 bg-surface-container-low/95 dark:bg-neutral-800/90 hover:bg-surface-container border-b border-surface-container-high/60 flex items-center justify-between gap-2 cursor-move transition-colors select-none relative"
                title="Klik dan tahan di sini untuk menggeser posisi video"
              >
                {/* Gagang Resize Sudut Kiri-Atas (Top-Left) */}
                <div 
                  onPointerDown={(e) => handleResizeDown(e, 'top-left')}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeUp}
                  onPointerCancel={handleResizeUp}
                  style={{ touchAction: 'none' }}
                  className="absolute top-0 left-0 w-6 h-6 z-20 flex items-start justify-start p-1 cursor-nwse-resize text-outline/40 hover:text-primary transition-colors group/tl"
                  title="Tarik sudut untuk mengubah ukuran video"
                >
                  <svg className="w-2.5 h-2.5 text-outline/40 group-hover/tl:text-primary transition-colors" viewBox="0 0 10 10" fill="currentColor">
                    <circle cx="2.5" cy="2.5" r="1.3" />
                    <circle cx="2.5" cy="6.5" r="1.3" />
                    <circle cx="6.5" cy="2.5" r="1.3" />
                  </svg>
                </div>

                <div className="flex items-center gap-2 min-w-0 pl-2">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-red-600 text-white shrink-0">
                    LIVE
                  </span>
                  <span className="text-xs font-bold text-on-surface truncate min-w-0">
                    {activeStream.channelName}
                  </span>
                </div>

                {/* Kontrol Kanan (Mencegah event drag terpicu saat tombol diklik) */}
                <div 
                  className="flex items-center gap-1 shrink-0"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {/* Tombol Minimize ke Audio Bar */}
                  <button
                    type="button"
                    onClick={minimizePlayer}
                    className="w-7 h-7 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    title="Kecilkan ke Bar Audio"
                    aria-label="Kecilkan ke Bar Audio"
                  >
                    <span className="material-symbols-outlined text-[18px]">expand_more</span>
                  </button>

                  {/* Tombol Maximize / Perbesar ke Modal */}
                  <button
                    type="button"
                    onClick={expandToModal}
                    className="w-7 h-7 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    title="Perbesar Tampilan (Modal)"
                    aria-label="Perbesar Tampilan Modal"
                  >
                    <span className="material-symbols-outlined text-[18px]">open_in_full</span>
                  </button>

                  {/* Tombol Tutup */}
                  <button
                    type="button"
                    onClick={handleClosePlayer}
                    className="w-7 h-7 rounded-lg text-outline hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    title="Tutup Pemutar"
                    aria-label="Tutup Pemutar"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Frame Video YouTube 16:9 */}
          <div className="relative aspect-video w-full bg-black">
            {isPipActive ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-neutral-950 text-center gap-2.5 select-none">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center animate-pulse">
                  <span className="material-symbols-outlined text-[24px]">picture_in_picture_alt</span>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white">Diputar di Jendela Melayang (PiP OS)</p>
                  <p className="text-[11px] text-white/60">
                    Suara di tab ini dijeda agar tidak ganda
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreFromPip}
                  className="mt-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
                >
                  <span className="material-symbols-outlined text-[15px]">tab</span>
                  <span>Kembalikan ke Sini</span>
                </button>
              </div>
            ) : (
              <>
                <iframe
                  ref={iframeRef}
                  key={`${activeStream.videoId}-${resumeTime}`}
                  src={`https://www.youtube.com/embed/${activeStream.videoId}?autoplay=1&mute=1&rel=0${resumeTime > 0 ? `&start=${resumeTime}` : ''}&enablejsapi=1&playsinline=1`}
                  title={activeStream.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  onLoad={() => {
                    try {
                      iframeRef.current?.contentWindow?.postMessage(
                        JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
                        '*'
                      );
                      setTimeout(() => {
                        try {
                          iframeRef.current?.contentWindow?.postMessage(
                            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
                            '*'
                          );
                          iframeRef.current?.contentWindow?.postMessage(
                            JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
                            '*'
                          );
                        } catch {}
                      }, 400);
                    } catch {}
                  }}
                  className="w-full h-full border-0"
                />

                {/* Tombol Nyalakan Suara jika dibatasi Browser saat autoplay */}
                {isPlayerMuted && (
                  <div
                    onClick={sendUnmuteMiniPlayer}
                    className="absolute bottom-2.5 left-2.5 sm:bottom-4 sm:left-4 z-20 cursor-pointer select-none animate-in fade-in duration-200"
                    title="Klik untuk menyalakan suara kajian"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        sendUnmuteMiniPlayer();
                      }}
                      className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-black/80 hover:bg-black/95 backdrop-blur-md text-white text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 shadow-xl border border-white/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px] sm:text-[16px] text-amber-400 animate-pulse">volume_off</span>
                      <span>Klik untuk Nyalakan Suara</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Info Judul & Tombol Kontrol */}
          {isModalExpanded ? (
            /* Modal Footer Layar Penuh */
            <div className="p-3.5 sm:p-4 bg-surface-container-lowest flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-surface-container-high/60">
              <div className="min-w-0">
                <span className="text-xs font-bold text-red-600 truncate block">
                  {activeStream.channelName}
                </span>
                {activeStream.speakerName && (
                  <span className="text-[11px] text-outline truncate block mt-0.5">
                    {activeStream.speakerName}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                {/* Tombol Mode Belajar */}
                <button
                  type="button"
                  onClick={() => {
                    openStudyMode({
                      videoId: activeStream.videoId,
                      title: activeStream.title,
                      channelName: activeStream.channelName,
                      speakerName: activeStream.speakerName || '',
                    });
                    collapseModal();
                  }}
                  className="h-9 sm:h-auto px-3 sm:px-3.5 py-2 sm:py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95 whitespace-nowrap"
                  title="Buka Mode Belajar untuk menyimak sambil mencatat faidah"
                >
                  <span className="material-symbols-outlined text-[16px]">edit_note</span>
                  <span>Mode Belajar</span>
                </button>

                {/* Tombol Putar di Mini Player / Perkecil */}
                <button
                  type="button"
                  onClick={collapseModal}
                  className="h-9 sm:h-auto px-3 py-2 sm:py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 whitespace-nowrap"
                  title="Kembalikan ke Mini Player di pojok layar"
                >
                  <span className="material-symbols-outlined text-[16px] text-red-600">picture_in_picture_alt</span>
                  <span>Putar di Pojok</span>
                </button>

                {/* Tombol Buka di YouTube */}
                <a
                  href={`https://www.youtube.com/watch?v=${activeStream.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 sm:h-auto px-3 sm:px-3.5 py-2 sm:py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface flex items-center justify-center gap-1.5 transition-colors active:scale-95 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>YouTube</span>
                </a>

                {/* Tombol Tutup */}
                <button
                  type="button"
                  onClick={handleClosePlayer}
                  className="h-9 sm:h-auto px-4 py-2 sm:py-1.5 rounded-xl bg-surface-container-high sm:bg-primary text-on-surface sm:text-on-primary text-xs font-semibold hover:bg-surface-container-highest sm:hover:bg-primary/90 transition-colors cursor-pointer active:scale-95 flex items-center justify-center whitespace-nowrap"
                >
                  Tutup
                </button>
              </div>
            </div>
          ) : (
            /* Footer Info Judul & Tombol Audio Floating Biasa */
            <div 
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{ touchAction: 'none' }}
              className="p-3 bg-surface-container-lowest/90 dark:bg-neutral-900/90 hover:bg-surface-container-low transition-colors flex items-start justify-between gap-2.5 cursor-move select-none relative"
              title="Klik dan tahan untuk menggeser posisi"
            >
              {/* Gagang Resize Sudut Kiri-Bawah (Bottom-Left) */}
              <div 
                onPointerDown={(e) => handleResizeDown(e, 'bottom-left')}
                onPointerMove={handleResizeMove}
                onPointerUp={handleResizeUp}
                onPointerCancel={handleResizeUp}
                style={{ touchAction: 'none' }}
                className="absolute bottom-0 left-0 w-6 h-6 z-20 flex items-end justify-start p-1 cursor-nesw-resize text-outline/40 hover:text-primary transition-colors group/bl"
                title="Tarik sudut untuk mengubah ukuran video"
              >
                <svg className="w-2.5 h-2.5 text-outline/40 group-hover/bl:text-primary transition-colors" viewBox="0 0 10 10" fill="currentColor">
                  <circle cx="2.5" cy="7.5" r="1.3" />
                  <circle cx="2.5" cy="3.5" r="1.3" />
                  <circle cx="6.5" cy="7.5" r="1.3" />
                </svg>
              </div>

              <div className="min-w-0 flex-1 pl-2 pr-2">
                <h4 className="text-xs font-semibold text-on-surface line-clamp-2 leading-snug">
                  {activeStream.title}
                </h4>
              </div>

              {/* Grup Tombol Aksi Bawah: Catatan Faidah & PiP OS */}
              <div 
                className="flex items-center gap-1 shrink-0 ml-1"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* Tombol Mode Belajar (Buku Saku Faidah / Catatan) */}
                <button
                  type="button"
                  onClick={() => {
                    if (isStudyNotesOpen) {
                      toggleMinimizeStudyNotes();
                    } else {
                      openStudyMode({
                        videoId: activeStream.videoId,
                        title: activeStream.title,
                        speakerName: activeStream.speakerName,
                        channelName: activeStream.channelName,
                      });
                    }
                  }}
                  className={`${
                    FEATURE_FLAGS.ENABLE_MOBILE_STUDY_NOTES ? 'flex' : 'hidden md:flex'
                  } w-7 h-7 rounded-lg items-center justify-center transition-colors cursor-pointer ${
                    isStudyNotesOpen
                      ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 font-bold'
                      : 'text-outline hover:text-emerald-600 hover:bg-emerald-500/10'
                  }`}
                  title={isStudyNotesOpen ? 'Sembunyikan / Tampilkan Catatan' : 'Buka Catatan Faidah (Sticky Note)'}
                  aria-label="Mode Belajar"
                >
                  <span className="material-symbols-outlined text-[18px]">edit_note</span>
                </button>

                {/* Tombol PiP OS (Pop-out di Luar Browser - Hanya Desktop) */}
                <button
                  type="button"
                  onClick={handleTogglePip}
                  className={`hidden md:flex w-7 h-7 rounded-lg items-center justify-center transition-colors cursor-pointer ${
                    isPipActive
                      ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                      : 'text-outline hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-surface-container'
                  }`}
                  title={
                    isPipActive
                      ? 'Kembalikan Video ke Tab Web Ini'
                      : currentUser
                      ? 'Buka Jendela Melayang di Luar Browser (PiP OS)'
                      : 'Buka Jendela Melayang di Luar Browser (Khusus Pengguna Masuk Akun)'
                  }
                  aria-label="Picture in Picture OS"
                >
                  <span className="material-symbols-outlined text-[19px]">picture_in_picture_alt</span>
                </button>
              </div>

              {/* Gagang Resize Sudut Kanan-Bawah (Bottom-Right) */}
              <div 
                onPointerDown={(e) => handleResizeDown(e, 'bottom-right')}
                onPointerMove={handleResizeMove}
                onPointerUp={handleResizeUp}
                onPointerCancel={handleResizeUp}
                style={{ touchAction: 'none' }}
                className="absolute bottom-0 right-0 w-6 h-6 z-20 flex items-end justify-end p-1 cursor-nwse-resize text-outline/40 hover:text-primary transition-colors group/br"
                title="Tarik sudut untuk mengubah ukuran video"
              >
                <svg className="w-2.5 h-2.5 text-outline/40 group-hover/br:text-primary transition-colors" viewBox="0 0 10 10" fill="currentColor">
                  <circle cx="7.5" cy="7.5" r="1.3" />
                  <circle cx="7.5" cy="3.5" r="1.3" />
                  <circle cx="3.5" cy="7.5" r="1.3" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

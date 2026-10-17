'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useLivePlayer } from '@/context/LivePlayerContext';

export default function PersistentFloatingLivePlayer() {
  const {
    activeStream,
    isOpen,
    isMinimized,
    closePlayer,
    toggleMinimize,
    maximizePlayer,
    minimizePlayer,
    openStudyMode,
    isStudyModeOpen,
    isStudyNotesOpen,
    toggleMinimizeStudyNotes,
  } = useLivePlayer();

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [playerWidth, setPlayerWidth] = useState<number>(360);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [activeCorner, setActiveCorner] = useState<'top-left' | 'bottom-left' | 'bottom-right' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Handler Pointer Drag
  const handlePointerDown = (e: React.PointerEvent) => {
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

  if (!isOpen || !activeStream) {
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
        style={{
          width: isMinimized ? undefined : `${playerWidth}px`,
          ...(position ? {
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            right: 'auto',
            bottom: 'auto',
            zIndex: 50,
          } : {}),
        }}
        className={`fixed z-50 max-w-[calc(100vw-24px)] ${
          isResizing ? 'transition-none select-none' : 'transition-shadow duration-200'
        } ${
          !position ? 'bottom-[72px] md:bottom-4 right-3 sm:right-4' : ''
        } ${isDragging || isResizing ? 'shadow-2xl scale-[1.01]' : ''}`}
      >
        {/* 
          PENTING: Iframe YouTube harus selalu berada di DOM 
          agar audio tetap berputar kontinu tanpa restart saat minimize/maximize.
        */}
        {/* 
          1. MODE MINIMIZED / COMPACT AUDIO BAR (DRAGGABLE)
          Dirender saat isMinimized === true. 
        */}
        {isMinimized && (
          <div 
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ touchAction: 'none' }}
            className="h-12 px-3.5 rounded-full bg-surface-container-lowest/95 dark:bg-neutral-900/95 backdrop-blur-md border border-red-500/30 dark:border-red-500/40 hover:border-red-500/70 shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-2 duration-200 cursor-move hover:bg-surface-container-low transition-colors select-none"
            title="Klik dan tahan untuk menggeser posisi bar audio"
          >
            {/* Audio Visualizer & Red Dot */}
            <div className="flex items-center gap-1.5 shrink-0">
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
            </div>

            {/* Teks Channel & Judul Ringkas */}
            <div className="min-w-0 max-w-[170px] sm:max-w-[220px]">
              <p className="text-[11px] font-bold text-on-surface truncate leading-tight">
                {activeStream.channelName}
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
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  isStudyNotesOpen
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 font-bold'
                    : 'text-outline hover:text-emerald-600 hover:bg-surface-container'
                }`}
                title={isStudyNotesOpen ? 'Sembunyikan / Tampilkan Catatan' : 'Buka Catatan Faidah (Sticky Note)'}
                aria-label="Catatan Faidah"
              >
                <span className="material-symbols-outlined text-[15px]">edit_note</span>
              </button>

              <button
                type="button"
                onClick={maximizePlayer}
                className="w-7 h-7 rounded-full bg-surface-container hover:bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                title="Perbesar Tampilan Video"
                aria-label="Perbesar Video"
              >
                <span className="material-symbols-outlined text-[17px]">expand_less</span>
              </button>

              <button
                type="button"
                onClick={closePlayer}
                className="w-7 h-7 rounded-full hover:bg-surface-container text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                title="Tutup Player"
                aria-label="Tutup Player"
              >
                <span className="material-symbols-outlined text-[17px]">close</span>
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
            isMinimized
              ? "absolute bottom-0 right-0 w-[240px] h-[135px] opacity-0 pointer-events-none -z-50 overflow-hidden"
              : "relative w-full rounded-2xl bg-surface-container-lowest/95 dark:bg-neutral-900/95 backdrop-blur-md border border-surface-container-high/80 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300"
          }
        >
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
              className="flex items-center gap-0.5 shrink-0"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Tombol Minimize ke Audio Bar */}
              <button
                type="button"
                onClick={minimizePlayer}
                className="w-7 h-7 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
                title="Kecilkan ke Bar Audio"
                aria-label="Kecilkan ke Bar Audio"
              >
                <span className="material-symbols-outlined text-[18px]">expand_more</span>
              </button>

              {/* Tombol Mode Belajar (Buku Saku Faidah) */}
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
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  isStudyNotesOpen
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 font-bold'
                    : 'text-outline hover:text-emerald-600 hover:bg-emerald-500/10'
                }`}
                title={isStudyNotesOpen ? 'Sembunyikan / Tampilkan Catatan' : 'Buka Catatan Faidah (Sticky Note)'}
                aria-label="Mode Belajar"
              >
                <span className="material-symbols-outlined text-[17px]">edit_note</span>
              </button>

              {/* Tombol Buka Halaman Penuh /live */}
              <Link
                href="/live"
                className="w-7 h-7 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors"
                title="Buka Halaman Live Streaming"
                aria-label="Buka Halaman Live"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </Link>

              {/* Tombol Tutup */}
              <button
                type="button"
                onClick={closePlayer}
                className="w-7 h-7 rounded-lg text-outline hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-colors cursor-pointer ml-0.5"
                title="Tutup Pemutar"
                aria-label="Tutup Pemutar"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* Frame Video YouTube 16:9 (SINGLE PERSISTENT IFRAME) */}
          <div className="relative aspect-video w-full bg-black">
            <iframe
              key={activeStream.videoId}
              src={`https://www.youtube-nocookie.com/embed/${activeStream.videoId}?autoplay=1&enablejsapi=1&rel=0`}
              title={activeStream.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>

          {/* Footer Info Judul & Tombol Audio */}
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

            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={minimizePlayer}
              className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[10px] font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer mt-0.5"
              title="Kecilkan ke Bar Audio sambil membaca"
            >
              <span className="material-symbols-outlined text-[12px]">headphones</span>
              <span>Audio</span>
            </button>

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
        </div>
      </div>
    </>
  );
}

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
  } = useLivePlayer();

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    initialLeft: number;
    initialTop: number;
  } | null>(null);

  // Helper untuk membatasi posisi agar tidak keluar dari viewport layar
  const clampPosition = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined') return { x, y };
    const rect = containerRef.current?.getBoundingClientRect();
    const width = rect?.width || (isMinimized ? 280 : 360);
    const height = rect?.height || (isMinimized ? 48 : 280);

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
  }, [isMinimized]);

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

  // Re-clamp posisi saat mode diminimalkan/dibesarkan
  useEffect(() => {
    if (position) {
      setPosition((prev) => (prev ? clampPosition(prev.x, prev.y) : null));
    }
  }, [isMinimized, clampPosition]);

  // Re-clamp saat ukuran layar jendela diubah / rotate device
  useEffect(() => {
    const handleResize = () => {
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
        Overlay transparan saat proses drag aktif 
        Mencegah mouse event tersangkut / tertelan ke dalam YouTube iframe 
      */}
      {isDragging && (
        <div 
          className="fixed inset-0 z-[60] cursor-move select-none"
          style={{ touchAction: 'none' }}
        />
      )}

      <div 
        ref={containerRef}
        style={position ? {
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          right: 'auto',
          bottom: 'auto',
          zIndex: 50,
        } : undefined}
        className={`fixed z-50 max-w-[calc(100vw-24px)] sm:max-w-[400px] transition-shadow duration-200 ${
          !position ? 'bottom-[72px] md:bottom-4 right-3 sm:right-4' : ''
        } ${isDragging ? 'shadow-2xl scale-[1.01]' : ''}`}
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
              : "w-[320px] sm:w-[380px] rounded-2xl bg-surface-container-lowest/95 dark:bg-neutral-900/95 backdrop-blur-md border border-surface-container-high/80 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300"
          }
        >
          {/* Header Card sebagai Pegangan Drag (Handle) */}
          <div 
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ touchAction: 'none' }}
            className="px-3.5 py-2.5 bg-surface-container-low/95 dark:bg-neutral-800/90 hover:bg-surface-container border-b border-surface-container-high/60 flex items-center justify-between gap-2 cursor-move transition-colors select-none"
            title="Klik dan tahan di sini untuk menggeser posisi video"
          >
            <div className="flex items-center gap-2 min-w-0">
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
            className="p-3 bg-surface-container-lowest/90 dark:bg-neutral-900/90 hover:bg-surface-container-low transition-colors flex items-start justify-between gap-2.5 cursor-move select-none"
            title="Klik dan tahan untuk menggeser posisi"
          >
            <div className="min-w-0 flex-1">
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
          </div>
        </div>
      </div>
    </>
  );
}

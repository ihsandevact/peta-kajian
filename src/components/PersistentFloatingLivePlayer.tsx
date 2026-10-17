'use client';

import React from 'react';
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

  if (!isOpen || !activeStream) {
    return null;
  }

  return (
    <div className="fixed bottom-[72px] md:bottom-4 right-3 sm:right-4 z-50 max-w-[calc(100vw-24px)] sm:max-w-[400px]">
      {/* 
        PENTING: Iframe YouTube harus selalu berada di DOM 
        agar audio tetap berputar kontinu tanpa restart saat minimize/maximize.
      */}
      {isMinimized ? (
        /* MODE MINIMIZED / COMPACT AUDIO BAR */
        <div className="h-12 px-3.5 rounded-full bg-surface-container-lowest/95 dark:bg-neutral-900/95 backdrop-blur-md border border-red-500/30 dark:border-red-500/40 shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-2 duration-200">
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

          {/* Teks Judul & Pemateri Ringkas */}
          <div className="min-w-0 max-w-[170px] sm:max-w-[220px]">
            <p className="text-[11px] font-bold text-on-surface truncate leading-tight">
              {activeStream.speakerName || activeStream.channelName}
            </p>
            <p className="text-[10px] text-outline truncate leading-tight">
              {activeStream.title}
            </p>
          </div>

          {/* Kontrol Kanan */}
          <div className="flex items-center gap-1 shrink-0 ml-1">
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

          {/* Hidden Iframe agar Audio Tetap Jalan */}
          <div className="absolute w-1 h-1 opacity-0 pointer-events-none -z-10 overflow-hidden">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${activeStream.videoId}?autoplay=1&enablejsapi=1&rel=0`}
              title={activeStream.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      ) : (
        /* MODE NORMAL MINI PLAYER CARD (VIDEO 16:9) */
        <div className="w-[320px] sm:w-[380px] rounded-2xl bg-surface-container-lowest/95 dark:bg-neutral-900/95 backdrop-blur-md border border-surface-container-high/80 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
          {/* Header Card */}
          <div className="px-3.5 py-2.5 bg-surface-container-low/90 border-b border-surface-container-high/60 flex items-center justify-between gap-2">
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

            <div className="flex items-center gap-0.5 shrink-0">
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

          {/* Frame Video YouTube 16:9 */}
          <div className="relative aspect-video w-full bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${activeStream.videoId}?autoplay=1&enablejsapi=1&rel=0`}
              title={activeStream.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>

          {/* Footer Info Judul & Pemateri */}
          <div className="p-3 bg-surface-container-lowest/80 flex items-start justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-semibold text-on-surface line-clamp-2 leading-snug">
                {activeStream.title}
              </h4>
              {activeStream.speakerName && (
                <p className="text-[11px] text-outline truncate mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-primary">person</span>
                  <span>{activeStream.speakerName}</span>
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={minimizePlayer}
              className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[10px] font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer mt-0.5"
              title="Kecilkan ke Bar Audio sambil membaca"
            >
              <span className="material-symbols-outlined text-[12px]">headphones</span>
              <span>Audio</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
